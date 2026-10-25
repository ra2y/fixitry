import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NormalizedFinding, Severity } from "../shared/types";

type Raw = Record<string, unknown>;
const str = (value: unknown) => (typeof value === "string" ? value : undefined);
const num = (value: unknown) => (typeof value === "number" ? value : undefined);

function mapSeverity(value: unknown): Severity {
  switch (str(value)?.toUpperCase()) {
    case "ERROR": return "HIGH";
    case "WARNING": return "MEDIUM";
    case "INFO": return "LOW";
    default: return "UNKNOWN";
  }
}

function clean<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

async function sourceLine(repoDir: string, target: string, line: number, cache: Map<string, string[]>) {
  const full = path.resolve(repoDir, target);
  if (!full.startsWith(path.resolve(repoDir) + path.sep)) return "";
  let lines = cache.get(full);
  if (!lines) {
    lines = (await readFile(full, "utf8").catch(() => "")).split(/\r?\n/);
    cache.set(full, lines);
  }
  return (lines[line - 1] ?? "").trim().replace(/\s+/g, " ");
}

export async function parseSemgrep(json: unknown, repoDir: string): Promise<NormalizedFinding[]> {
  const results = (json as Raw | null)?.results;
  if (!Array.isArray(results)) return [];
  const cache = new Map<string, string[]>();
  const seen = new Map<string, number>();
  const findings: NormalizedFinding[] = [];

  for (const result of results as Raw[]) {
    const checkId = str(result.check_id) ?? "unknown-rule";
    const ruleId = (checkId.split(".").pop() ?? checkId).slice(0, 100);
    const target = (str(result.path) ?? "").replace(/\\/g, "/").slice(0, 300);
    const line = num((result.start as Raw | undefined)?.line);
    const extra = (result.extra ?? {}) as Raw;
    const metadata = (extra.metadata ?? {}) as Raw;
    const text = line && target ? await sourceLine(repoDir, target, line, cache) : "";
    const lineHash = createHash("sha256").update(text).digest("hex").slice(0, 8);
    const base = ["code", ruleId, target, lineHash].join("|");
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    findings.push(clean({
      fingerprint: count === 1 ? base : `${base}#${count}`,
      source: "semgrep" as const,
      kind: "code" as const,
      severity: mapSeverity(extra.severity),
      ruleId,
      title: (str(metadata.cwe) ?? ruleId).slice(0, 300),
      target,
      description: (str(extra.message) ?? "").slice(0, 600),
      startLine: line,
    }));
  }
  return findings;
}

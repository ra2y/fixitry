import type { NormalizedFinding, Severity } from "../shared/types";

type Raw = Record<string, unknown>;
const str = (x: unknown) => (typeof x === "string" ? x : undefined);
const num = (x: unknown) => (typeof x === "number" ? x : undefined);
const cap = (x: unknown, n: number) => (str(x) ?? "").slice(0, n);

function severity(x: unknown): Severity {
  const s = str(x)?.toUpperCase();
  return s === "CRITICAL" || s === "HIGH" || s === "MEDIUM" || s === "LOW" ? s : "UNKNOWN";
}

function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

export function parseTrivy(json: unknown): NormalizedFinding[] {
  const results = (json as Raw | null)?.Results;
  if (!Array.isArray(results)) return []; // no findings: Trivy omits Results

  const out: NormalizedFinding[] = [];
  const seen = new Map<string, number>();
  const push = (f: Omit<NormalizedFinding, "fingerprint">, fpParts: string[]) => {
    const base = fpParts.join("|");
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    out.push(clean({ ...f, fingerprint: n === 1 ? base : `${base}#${n}` }));
  };

  for (const r of results as Raw[]) {
    const target = cap(r.Target, 300);

    for (const v of (Array.isArray(r.Vulnerabilities) ? r.Vulnerabilities : []) as Raw[]) {
      push({
        kind: "vulnerability", severity: severity(v.Severity), ruleId: cap(v.VulnerabilityID, 100),
        title: cap(v.Title ?? v.VulnerabilityID, 300), target, description: cap(v.Description, 600),
        packageName: str(v.PkgName), installedVersion: str(v.InstalledVersion), fixedVersion: str(v.FixedVersion),
      }, ["vulnerability", cap(v.VulnerabilityID, 100), target, cap(v.PkgName, 100)]);
    }

    for (const m of (Array.isArray(r.Misconfigurations) ? r.Misconfigurations : []) as Raw[]) {
      const meta = (m.CauseMetadata ?? {}) as Raw;
      push({
        kind: "misconfiguration", severity: severity(m.Severity), ruleId: cap(m.ID ?? m.AVDID, 100),
        title: cap(m.Title, 300), target, description: cap(m.Message ?? m.Description, 600),
        startLine: num(meta.StartLine),
      }, ["misconfiguration", cap(m.ID ?? m.AVDID, 100), target]);
    }

    for (const s of (Array.isArray(r.Secrets) ? r.Secrets : []) as Raw[]) {
      push({
        kind: "secret", severity: severity(s.Severity), ruleId: cap(s.RuleID, 100),
        title: cap(s.Title, 300), target, description: `${cap(s.Category, 100)} secret detected`,
        startLine: num(s.StartLine),
      }, ["secret", cap(s.RuleID, 100), target]);
    }
  }
  return out;
}
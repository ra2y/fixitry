import type { NormalizedFinding, Severity } from "../shared/types";

type Raw = Record<string, unknown>;
const str = (x: unknown) => (typeof x === "string" ? x : "");

// ZAP risk codes: 3 High, 2 Medium, 1 Low, 0 Informational (skipped: too noisy to approve).
function riskToSeverity(code: unknown): Severity | null {
  switch (String(code)) {
    case "3": return "HIGH";
    case "2": return "MEDIUM";
    case "1": return "LOW";
    default: return null;
  }
}

// ZAP descriptions are HTML. Reduce to plain text and cap the length.
function plain(html: string, max: number): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function pathOf(uri: string): string {
  try {
    return new URL(uri).pathname.slice(0, 300) || "/";
  } catch {
    return uri.slice(0, 300);
  }
}

function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "")) as T;
}

export function parseZap(json: unknown): NormalizedFinding[] {
  const sites = (json as Raw | null)?.site;
  if (!Array.isArray(sites)) return [];

  const out = new Map<string, NormalizedFinding>();

  for (const site of sites as Raw[]) {
    for (const a of (Array.isArray(site.alerts) ? site.alerts : []) as Raw[]) {
      const severity = riskToSeverity(a.riskcode);
      if (!severity) continue;

      const pluginId = str(a.pluginid) || "unknown";
      const instances = (Array.isArray(a.instances) ? a.instances : []) as Raw[];
      const systemic = a.systemic === true;
      const title = str(a.name).slice(0, 300);
      const guidance = `${plain(str(a.desc), 450)} Fix guidance: ${plain(str(a.solution), 350)}`.slice(0, 900);

      if (systemic) {
        // Site-wide issue (for example a missing header): one finding, however many URLs.
        const first = instances[0] ?? {};
        const param = str(first.param).slice(0, 100);
        const paths = [...new Set(instances.map((i) => pathOf(str(i.uri))))].slice(0, 10);
        const fingerprint = ["dynamic", pluginId, param].join("|");
        out.set(fingerprint, clean({
          fingerprint, source: "zap" as const, kind: "dynamic" as const, severity,
          ruleId: `zap-${pluginId}`.slice(0, 100), title, target: paths[0] ?? "/",
          description: `${guidance} Seen on ${instances.length} URL(s).`.slice(0, 900),
          httpMethod: str(first.method) || undefined, parameter: param || undefined,
          evidence: str(first.evidence).slice(0, 120) || undefined, affectedPaths: paths,
        }));
      } else {
        // Injection-style issue: one finding per method + path + parameter.
        for (const i of instances) {
          const method = str(i.method).toUpperCase();
          const path = pathOf(str(i.uri));
          const param = str(i.param).slice(0, 100);
          const fingerprint = ["dynamic", pluginId, method, path, param].join("|");
          if (out.has(fingerprint)) continue;
          out.set(fingerprint, clean({
            fingerprint, source: "zap" as const, kind: "dynamic" as const, severity,
            ruleId: `zap-${pluginId}`.slice(0, 100), title, target: path, description: guidance,
            httpMethod: method || undefined, parameter: param || undefined,
            evidence: str(i.evidence).slice(0, 120) || undefined, affectedPaths: [path],
          }));
        }
      }
    }
  }
  return [...out.values()];
}
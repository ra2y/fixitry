export type FindingKind = "vulnerability" | "secret" | "misconfiguration" | "code";
export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
export type FindingSource = "trivy" | "semgrep";

export interface NormalizedFinding {
  fingerprint: string;
  kind: FindingKind;
  source?: FindingSource;
  severity: Severity;
  ruleId: string;
  title: string;
  target: string;
  description: string;
  startLine?: number;
  packageName?: string;
  installedVersion?: string;
  fixedVersion?: string;
}

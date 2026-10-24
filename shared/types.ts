export type FindingKind = "vulnerability" | "secret" | "misconfiguration";
export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export interface NormalizedFinding {
  fingerprint: string;
  kind: FindingKind;
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
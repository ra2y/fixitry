export function compareFindings<T extends { fingerprint: string }>(before: T[], after: T[]) {
  const beforeSet = new Set(before.map((finding) => finding.fingerprint));
  const afterSet = new Set(after.map((finding) => finding.fingerprint));
  return {
    resolved: before.filter((finding) => !afterSet.has(finding.fingerprint)),
    remaining: before.filter((finding) => afterSet.has(finding.fingerprint)),
    introduced: after.filter((finding) => !beforeSet.has(finding.fingerprint)),
  };
}

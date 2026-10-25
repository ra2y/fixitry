const EDITABLE = /\.(py|js|jsx|ts|tsx|mjs|cjs|json|html|jinja2?|j2|yml|yaml|toml|cfg|ini|conf|rb|php|go|java|cs)$/i;
const BLOCKED =
  /(^|\/)(\.env[^/]*|\.git[^/]*|node_modules|tests?|__tests__|\.venv|venv|trivy-secret\.yaml)(\/|$)|\.(pem|key|crt)$/i;

export function filterEditable(paths: string[]): string[] {
  return paths
    .map((p) => p.replace(/\\/g, "/"))
    .filter((p) => EDITABLE.test(p) && !BLOCKED.test(p))
    .sort()
    .slice(0, 1000);
}
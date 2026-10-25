export type ZapMode = "baseline" | "active";

// Runs inside the ZAP container, which shares the target's network namespace.
export const WAIT_SCRIPT = `import sys, time, urllib.request, urllib.error

url, seconds = sys.argv[1], int(sys.argv[2])
deadline = time.time() + seconds
while time.time() < deadline:
    try:
        urllib.request.urlopen(url, timeout=2)
        sys.exit(0)
    except urllib.error.HTTPError:
        sys.exit(0)  # the app answered (even with an error), so it is up
    except Exception:
        time.sleep(1)
sys.exit(1)
`;

export function buildPlan(opts: { mode: ZapMode; port: number; workDir: string }): string {
  if (!Number.isInteger(opts.port) || opts.port < 1 || opts.port > 65535) {
    throw new Error("Invalid target port");
  }
  const target = `http://127.0.0.1:${opts.port}`;
  const active =
    opts.mode === "active"
      ? `  - type: activeScan
    parameters:
      context: target
      maxRuleDurationInMins: 2
      maxScanDurationInMins: 15
  - type: passiveScan-wait
    parameters:
      maxDuration: 2
`
      : "";

  return `env:
  contexts:
    - name: target
      urls:
        - ${target}
      includePaths:
        - ${target}.*
  parameters:
    failOnError: true
    failOnWarning: false
    progressToStdout: true
jobs:
  - type: openapi
    parameters:
      apiFile: ${opts.workDir}/openapi.yaml
      targetUrl: ${target}
      context: target
  - type: passiveScan-wait
    parameters:
      maxDuration: 2
${active}  - type: report
    parameters:
      template: traditional-json
      reportDir: ${opts.workDir}
      reportFile: zap-report
      reportTitle: Fixitry ${opts.mode} scan
    risks: [high, medium, low, info]
`;
}
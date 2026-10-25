import { run } from "./exec";

export const ZAP_LABEL = "fixitry=zap";

export function bindMount(source: string, target: string, readonly: boolean): string[] {
  // --mount uses comma-separated key=value pairs, so a comma in a path would corrupt it.
  if (source.includes(",")) throw new Error(`Cannot mount a path containing a comma: ${source}`);
  return ["--mount", `type=bind,source=${source},target=${target}${readonly ? ",readonly" : ""}`];
}

// Remove anything a crashed worker left behind (containers and images we labelled).
export async function sweepZapLeftovers(): Promise<void> {
  const containers = await run("docker", ["ps", "-aq", "--filter", `label=${ZAP_LABEL}`], { timeoutMs: 30_000 });
  const ids = containers.stdout.split(/\s+/).filter(Boolean);
  if (ids.length) await run("docker", ["rm", "-f", ...ids], { timeoutMs: 60_000 });

  const images = await run("docker", ["images", "-q", "--filter", `label=${ZAP_LABEL}`], { timeoutMs: 30_000 });
  const imgIds = [...new Set(images.stdout.split(/\s+/).filter(Boolean))];
  if (imgIds.length) await run("docker", ["rmi", "-f", ...imgIds], { timeoutMs: 120_000 });
}
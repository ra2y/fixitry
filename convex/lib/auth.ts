export function assertWorker(secret: string): void {
  const expected = process.env.WORKER_SECRET;
  if (!expected) {
    throw new Error("WORKER_SECRET is not configured on this deployment");
  }

  // Compare the complete strings so a mismatch does not reveal its prefix.
  let diff = secret.length ^ expected.length;
  for (let index = 0; index < expected.length; index += 1) {
    diff |= (secret.charCodeAt(index) || 0) ^ expected.charCodeAt(index);
  }

  if (diff !== 0) {
    throw new Error("Unauthorized");
  }
}

import { api } from "../convex/_generated/api";
import { config } from "./config";
import { convex } from "./convexClient";

async function main() {
  console.log(`[${config.workerId}] starting`);
  const response = await convex.query(api.jobs.workerPing, {
    secret: config.workerSecret,
  });
  console.log("Connected to Convex:", response);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

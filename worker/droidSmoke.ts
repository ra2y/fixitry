import "dotenv/config";
import {
  AutonomyLevel,
  DroidInteractionMode,
  DroidMessageType,
  ToolConfirmationOutcome,
  createSession,
} from "@factory/droid-sdk/node";

async function main() {
  const repoDir = process.argv[2];
  if (!repoDir) {
    throw new Error("Usage: npx tsx worker/droidSmoke.ts <path-to-a-cloned-repo>");
  }

  const apiKey = process.env.FACTORY_API_KEY;
  if (!apiKey) {
    throw new Error("FACTORY_API_KEY is not set");
  }

  const session = await createSession({
    apiKey,
    cwd: repoDir,
    interactionMode: DroidInteractionMode.Spec,
    autonomyLevel: AutonomyLevel.Low,
    disabledToolIds: ["Execute"],
    permissionHandler: ({ toolUses }) => {
      console.log("PERMISSION REQUEST:", toolUses.map((tool) => tool.details.type));
      return ToolConfirmationOutcome.Cancel;
    },
  });

  try {
    console.log("Session cwd:", session.cwd);
    for (const tool of await session.listTools()) {
      console.log("tool:", tool.id, "allowed:", tool.allowed);
    }

    for await (const message of session.stream(
      "Describe this repository in 5 sentences: language, framework, entry point, and how tests are run. Do not modify anything.",
    )) {
      if (message.type === DroidMessageType.ToolCall) {
        console.log("[tool call]", message.name);
      }
      if (message.type === DroidMessageType.Assistant) {
        console.log("[assistant]", message.text);
      }
      if (message.type === DroidMessageType.Error) {
        console.error("[error]", message.message);
      }
      if (message.type === DroidMessageType.Result) {
        console.log("[result]", message.subtype, "success:", message.success);
      }
    }
  } finally {
    await session.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

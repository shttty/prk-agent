import { appendFileSync } from "node:fs";
import { join } from "node:path";

export default function activate(pi) {
  appendFileSync(join(process.env.PRK_HOME, "event-error-loaded.log"), "loaded\n");
  pi.registerTool({ name: "plugstart_event_error", label: "Broken event fixture", description: "Must not be available.",
    parameters: { type: "object", properties: {} },
    async execute() { throw new Error("This tool must not execute"); },
  });
  pi.on("session_start", async () => { throw new Error("Startup hook failed in fixture B"); });
}

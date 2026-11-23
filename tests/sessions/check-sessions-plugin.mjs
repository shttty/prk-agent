// Real Pi Responses HTTP serialization, Gateway and owned Jupyter; no paid model calls.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { assemblePromptFixture } from "./prompt-sections/assemble-prompt-fixture.mjs";
import { captureFirstRequests } from "./sessions-plugin/capture-first-requests.mjs";

const { values } = parseArgs({ options: {
  "capture-only": { type: "boolean", default: false }, output: { type: "string" }, baseline: { type: "string" },
} });
if (values["capture-only"]) assert(values.output, "--capture-only requires --output DIRECTORY for full baseline artifacts");
if (values.baseline) assert(values.output, "--baseline requires --output DIRECTORY for candidate artifacts");
const home = await mkdtemp(join(tmpdir(), "prk-sessions-plugin-"));
const keys = ["HOME", "PRK_HOME", "PRK_CODING_AGENT_DIR", "PI_CODING_AGENT_DIR", "PRK_PROMPT_CAPTURE_FILE"];
const previous = new Map(keys.map((key) => [key, process.env[key]]));
process.env.HOME = join(home, "user-home");
process.env.PRK_HOME = home;
const { agentDir } = initializePrkHome(home);
try {
  await mkdir(process.env.HOME);
  const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");
  await withTargetFixture(async (jupyter) => {
    const fixture = await assemblePromptFixture({ home, agentDir, ...jupyter, workerTools: "direct" });
    const sessions = await captureFirstRequests(fixture, values.output);
    if (values.output) {
      await writeFile(join(values.output, "manifest.json"), `${JSON.stringify({ home, workerTools: "direct",
        globalCapabilities: { "lazy:tool:space_status": true, "lazy:tool:session_list": true, "lazy:tool:session_manage": true,
          ...Object.fromEntries(["skill-tools", "memory", "plugin-config", "terminals", "tool-library"].map((name) => [`lazy:group:tools:package:<inline:${name}>`, true])) },
        sessions: Object.fromEntries(Object.entries(sessions).map(([depth, name]) => [depth, { name, sessionId: fixture.host.state(name).sessionId }])),
      }, null, 2)}\n`);
    }
    if (values.baseline) {
      const { compareCaptures } = await import("./sessions-plugin/compare-captures.mjs");
      await compareCaptures(values.baseline, values.output);
    }
    if (!values["capture-only"]) {
      const { checkPluginSwitches } = await import("./sessions-plugin/check-plugin-switches.mjs");
      await checkPluginSwitches(fixture, sessions, home);
    }
    console.log(JSON.stringify({ ok: true, mode: values["capture-only"] ? "capture-only" : "sessions-plugin",
      provider: "owned HTTP stub + unmodified Pi openai-responses", capture: "raw HTTP bytes matched to public before_provider_request",
      output: values.output ?? null, baseline: values.baseline ?? null }));
  });
} finally {
  for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  await rm(home, { recursive: true, force: true });
}

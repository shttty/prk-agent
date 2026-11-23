// Real Gateway, public Pi hooks, original Responses serializer and owned Jupyter; no paid calls.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { checkKernelPlugin } from "./closing-plugins/check-kernel-plugin.mjs";
import { checkLibraryPlugin } from "./closing-plugins/check-library-plugin.mjs";
import { checkToolSearchPlugin } from "./closing-plugins/check-tool-search-plugin.mjs";
import { checkDefinitions } from "./closing-plugins/check-definitions.mjs";

const { values } = parseArgs({ options: { repo: { type: "string" }, output: { type: "string" } } });
assert(process.env.JUPYTER_URL === undefined && process.env.JUPYTER_TOKEN === undefined, "Closing plugin acceptance requires its own Jupyter server");
const repo = values.repo ? resolve(values.repo) : fileURLToPath(new URL("../..", import.meta.url));
const load = (path) => import(pathToFileURL(join(repo, path)).href);
const { initializePrkHome } = await load("src/config/home/initialize-prk-home.ts");
const { assemblePromptFixture } = await load("tests/sessions/prompt-sections/assemble-prompt-fixture.mjs");
const { withTargetFixture } = await load("tests/fixtures/target-fixture.mjs");
const home = await mkdtemp(join(tmpdir(), "prk-closing-plugins-"));
const keys = ["HOME", "PRK_HOME", "PRK_CODING_AGENT_DIR", "PI_CODING_AGENT_DIR", "PRK_PROMPT_CAPTURE_FILE"];
const previous = new Map(keys.map((key) => [key, process.env[key]]));
process.env.HOME = join(home, "user-home");
process.env.PRK_HOME = home;
const { agentDir } = initializePrkHome(home);
const save = async (report) => {
  if (!values.output) return;
  await mkdir(values.output, { recursive: true });
  await writeFile(join(values.output, "closing-plugins.json"), `${JSON.stringify(report, null, 2)}\n`);
};
try {
  await mkdir(process.env.HOME);
  await withTargetFixture(async (jupyter) => {
    const fixture = await assemblePromptFixture({ home, agentDir, ...jupyter, workerTools: "direct",
      capabilities: { "lazy:group:tools:package:<inline:tool-library>": true } });
    const worker = (await fixture.host.createSession({ target: "fixture", label: "Closing plugin proof" })).session.sessionId;
    fixture.host.setSessionRoot({ sessionId: worker });
    const results = [await checkKernelPlugin(fixture, worker), await checkLibraryPlugin(fixture, worker, home),
      await checkToolSearchPlugin(fixture, worker), await checkDefinitions(load, home, agentDir)];
    for (const catalog of [(await fixture.host.capabilitiesList()).catalog, await fixture.action(worker, "capabilities")]) {
      assert(!JSON.stringify(catalog).includes("group:tools:prk"), "Retired PRK identity is absent from the complete real catalog");
    }
    const report = { ok: true, repo, provider: "owned loopback HTTP + unmodified Pi openai-responses", results };
    await save(report);
    console.log(JSON.stringify(report));
  });
} catch (error) {
  await save({ ok: false, repo, error: { name: error.name, message: error.message, stack: error.stack } });
  throw error;
} finally {
  for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  await rm(home, { recursive: true, force: true });
}

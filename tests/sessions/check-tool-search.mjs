import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { assembleFixture } from "../fixtures/tool-search/assemble-fixture.mjs";
import { checkDirect } from "../fixtures/tool-search/check-direct.mjs";
import { checkNestedCalls } from "../fixtures/tool-search/check-nested-calls.mjs";
import { checkLazySettings } from "../fixtures/tool-search/check-lazy-settings.mjs";
import { checkModes } from "../fixtures/tool-search/check-modes.mjs";
import { checkRenderers } from "../fixtures/tool-search/check-renderers.mjs";

if (process.env.JUPYTER_URL !== undefined || process.env.JUPYTER_TOKEN !== undefined) {
  throw new Error("Tool search acceptance requires its owned Jupyter fixture; unset JUPYTER_URL and JUPYTER_TOKEN.");
}
const home = await mkdtemp(join(tmpdir(), "prk-tool-search-"));
const environment = Object.fromEntries(["HOME", "PRK_HOME", "PRK_CODING_AGENT_DIR", "PI_CODING_AGENT_DIR"].map((key) => [key, process.env[key]]));
process.env.HOME = join(home, "user-home");
process.env.PRK_HOME = home;
await mkdir(process.env.HOME);
const { agentDir } = initializePrkHome(home);
try {
  const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");
  await withTargetFixture(async ({ config, onCleanup }) => {
    const fixture = await assembleFixture({ home, agentDir, config, onCleanup });
    if (!process.argv.includes("--renderers-only")) {
      await checkDirect(fixture);
      await checkNestedCalls(fixture);
      await checkLazySettings(fixture);
      await checkModes(fixture);
    }
    await checkRenderers(fixture);
    console.log(process.argv.includes("--renderers-only")
      ? "PASS real SDK tool_call nested renderCall/renderResult/renderShell through client extension-ui; first passthrough target survives fresh-client rendering after agent_end; outer rendering unchanged"
      : "PASS real SDK/Gateway/socket/Jupyter/faux: exact stable direct declarations, hidden schemas and guidelines, search without activation, real nested hooks and unchanged failure results, denied targets, immediate three-layer lazy precedence/reset/persistence, model-only/native eligibility, no-hidden meta removal and unchanged code declarations; real nested custom renderers through client extension-ui; controlled provider only");
  }, { rootDir: () => home });
} finally {
  for (const [key, value] of Object.entries(environment)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  await rm(home, { recursive: true, force: true });
}

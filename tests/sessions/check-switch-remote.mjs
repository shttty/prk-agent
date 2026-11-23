// Real Pi/Gateway/Jupyter/target-host switch regressions. Controlled provider; no paid models.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";

const scenarios = ["declarations", "search", "kernel", "meta", "remote"];
const selected = process.argv.slice(2);
assert(selected.every((name) => name === "all" || scenarios.includes(name)), `Usage: node tests/sessions/check-switch-remote.mjs [all|${scenarios.join("|")}]`);
assert(!process.env.JUPYTER_URL && !process.env.JUPYTER_TOKEN, "Unset JUPYTER_URL/JUPYTER_TOKEN; use only the owned Jupyter fixture");
assert(process.env.PI_TEST_PYTHON, "PI_TEST_PYTHON is required");
assert.equal(process.env.SHELL, "/bin/bash", "Run this acceptance test with SHELL=/bin/bash");
const root = await mkdtemp(join(tmpdir(), "prk-switch-remote-"));
const environment = Object.fromEntries(["HOME", "PRK_HOME", "PRK_CODING_AGENT_DIR", "PI_CODING_AGENT_DIR"].map((key) => [key, process.env[key]]));
process.env.HOME = join(root, "user-home");
process.env.PRK_HOME = join(root, "gateway");
await mkdir(process.env.HOME);
const { agentDir } = initializePrkHome(process.env.PRK_HOME);
try {
  const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");
  const { assembleRemoteSwitchFixture } = await import("../fixtures/switch-layers/assemble-remote-fixture.mjs");
  const { checkRemoteSwitchScenario } = await import("../fixtures/switch-layers/check-remote-scenario.mjs");
  await withTargetFixture(async ({ config, onCleanup }) => {
    const fixture = await assembleRemoteSwitchFixture({ root, home: process.env.PRK_HOME, agentDir, config, onCleanup });
    for (const scenario of !selected.length || selected.includes("all") ? scenarios : selected) {
      await checkRemoteSwitchScenario(fixture, scenario);
    }
  }, { tempParent: root, allowHidden: true, rootDir: () => root });
  console.log("PASS remote switch layers: selected scenarios use one real SDK session/kernel/host without reload");
} finally {
  for (const [key, value] of Object.entries(environment)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  await rm(root, { recursive: true, force: true });
}

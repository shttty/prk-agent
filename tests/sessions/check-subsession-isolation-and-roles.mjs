import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";

assert(process.env.JUPYTER_URL === undefined && process.env.JUPYTER_TOKEN === undefined,
  "Subsession acceptance requires an owned Jupyter fixture; unset JUPYTER_URL and JUPYTER_TOKEN.");
const home = await mkdtemp(join(tmpdir(), "prk-subsessions-"));
const keys = ["HOME", "PRK_HOME", "PRK_CODING_AGENT_DIR", "PI_CODING_AGENT_DIR"];
const previous = new Map(keys.map((key) => [key, process.env[key]]));
process.env.HOME = join(home, "user-home");
process.env.PRK_HOME = home;
const { agentDir } = initializePrkHome(home);
try {
  await mkdir(process.env.HOME, { recursive: true });
  const [{ withTargetFixture }, { assembleSubsessionFixture }, { checkDerivationApi }, { prepareTargetRepository },
    { checkRolePrecedence }, { checkWorktreeResults }, { checkIsolationLifecycle }, { checkParentContamination }] = await Promise.all([
    import("../fixtures/target-fixture.mjs"), import("./subsessions/assemble-subsession-fixture.mjs"),
    import("./subsessions/check-derivation-api.mjs"), import("./subsessions/prepare-target-repository.mjs"),
    import("./subsessions/check-role-precedence.mjs"), import("./subsessions/check-worktree-results.mjs"),
    import("./subsessions/check-isolation-lifecycle.mjs"), import("./subsessions/check-parent-contamination.mjs"),
  ]);
  await withTargetFixture(async (jupyter) => {
    assert.equal(jupyter.owned, true);
    const fixture = await assembleSubsessionFixture({ home, agentDir, ...jupyter });
    await checkDerivationApi(fixture);
    const repository = await prepareTargetRepository(fixture);
    await checkRolePrecedence({ ...fixture, ...repository });
    await checkWorktreeResults({ ...fixture, ...repository });
    await checkIsolationLifecycle({ ...fixture, ...repository });
    await checkParentContamination({ ...fixture, ...repository });
    console.log("PASS controlled-provider real SDK/Gateway/HTTP/Jupyter subsessions: strict settings roundtrip, role/depth/schema precedence, capability declaration+execution, local/remote target worktrees, complete binary patch delivery/apply, lifecycle cleanup and parent contamination rejection; no external-model autonomy claim");
  }, { rootDir: () => "/", allowHidden: true });
} finally {
  for (const [key, value] of previous) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  await rm(home, { recursive: true, force: true });
}

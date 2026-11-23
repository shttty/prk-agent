import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { startRig, closeRig } from "./start-rig.mjs";
import { seedFiles } from "./seed-files.mjs";
import { fileSteps } from "./steps-files.mjs";
import { pickerReferenceSteps } from "./steps-picker-reference.mjs";
import { opsSteps } from "./steps-ops.mjs";
import { retargetSteps } from "./steps-retarget.mjs";

// S2 real-component browser acceptance. Usage: node check-browser.mjs [group...]  (default: all groups)
const evidence = process.env.S2_BROWSER_EVIDENCE;
if (!evidence) throw new Error("Set S2_BROWSER_EVIDENCE to the evidence directory.");
const wanted = process.argv.slice(2);
const rig = await startRig(evidence);
const results = [];
let failed = 0;
try {
  const seed = await seedFiles(rig.root);
  rig.work = seed.work;
  rig.gateway.retarget({ cwd: seed.work }); // the session's saved cwd (the tree's and @'s start) is the `work` directory
  const state = {};
  const groups = { files: fileSteps(rig, seed, state), picker: pickerReferenceSteps(rig, seed, state), ops: opsSteps(rig, seed, state), retarget: retargetSteps(rig, seed, state) };
  for (const [group, steps] of Object.entries(groups)) {
    if (wanted.length && !wanted.includes(group)) continue;
    for (const [name, run] of steps) {
      try { await run(); results.push({ group, name, status: "PASS" }); await rig.log({ group, name, status: "PASS" }); }
      catch (error) {
        failed++;
        results.push({ group, name, status: "FAIL", error: error.message });
        await rig.log({ group, name, status: "FAIL", error: error.message });
        for (const driver of Object.values(state)) if (driver?.shot) await driver.shot(`FAIL-${results.length}`).catch(() => {});
      }
    }
  }
  for (const driver of Object.values(state)) if (driver?.seen) {
    await rig.log({ page: driver.name, requests: driver.seen.requests.length, failedResponses: driver.seen.failed, pageErrors: driver.seen.errors, consoleErrors: driver.seen.console.filter((entry) => entry.type === "error") });
  }
} finally {
  await closeRig(rig).catch((error) => { failed++; console.error(error.message); });
  await writeFile(join(evidence, "results.json"), JSON.stringify(results, null, 2));
}
process.exit(failed ? 1 : 0);

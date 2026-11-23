import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { startRig, closeRig } from "./start-rig.mjs";
import { liveSteps } from "./steps-live.mjs";
import { endSteps } from "./steps-end.mjs";

// S3 real-component browser acceptance on the real PTY fixture. Usage: S3_BROWSER_EVIDENCE=<dir> node check-pty-browser.mjs
const evidence = process.env.S3_BROWSER_EVIDENCE;
if (!evidence) throw new Error("Set S3_BROWSER_EVIDENCE to the evidence directory.");
const rig = await startRig(evidence);
const results = [];
const state = {};
let failed = 0;
try {
  for (const [name, run] of [...liveSteps(rig, state), ...endSteps(rig, state)]) {
    try { await Promise.race([run(), new Promise((_, reject) => setTimeout(() => reject(new Error("step exceeded 90s")), 90000))]); results.push({ name, status: "PASS" }); await rig.log({ name, status: "PASS" }); }
    catch (error) {
      failed++;
      results.push({ name, status: "FAIL", error: error.message });
      await rig.log({ name, status: "FAIL", error: error.message });
      if (state.d) await state.d.shot(`FAIL-${results.length}`).catch(() => {});
    }
  }
  for (const driver of [state.d, state.p]) if (driver) {
    await rig.log({ page: driver.name, sockets: driver.seen.sockets.map(({ shell, session, generationQuery, snapshot, closeCode }) => ({ shell, session, generationQuery, generation: snapshot?.generation, closeCode })), pageErrors: driver.seen.errors, failedResponses: driver.seen.failed, consoleErrors: driver.seen.console.filter((entry) => entry.type === "error").length });
  }
} finally {
  await closeRig(rig).catch((error) => { failed++; console.error(error.message); });
  await writeFile(join(evidence, "results.json"), JSON.stringify(results, null, 2));
}
process.exit(failed ? 1 : 0);

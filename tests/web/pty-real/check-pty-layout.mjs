import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { startRig, closeRig } from "./start-rig.mjs";
import { appLayoutSteps } from "./steps-app-layout.mjs";

// The user's two terminal size symptoms in the real App (production build + vite preview) on the real PTY fixture.
// Usage: S3_BROWSER_EVIDENCE=<NEW dir> node check-pty-layout.mjs [<web root to build instead of this checkout's web/>]
const evidence = process.env.S3_BROWSER_EVIDENCE;
if (!evidence) throw new Error("Set S3_BROWSER_EVIDENCE to a new evidence directory.");
const rig = await startRig(evidence, { preview: true, ...(process.argv[2] ? { webRoot: process.argv[2] } : {}) });
const results = [];
const state = {};
let failed = 0;
try {
  for (const [name, run] of appLayoutSteps(rig, state)) {
    try { await Promise.race([run(), new Promise((_, reject) => setTimeout(() => reject(new Error("step exceeded 90s")), 90000))]); results.push({ name, status: "PASS" }); await rig.log({ name, status: "PASS" }); }
    catch (error) {
      failed++;
      results.push({ name, status: "FAIL", error: error.message });
      await rig.log({ name, status: "FAIL", error: error.message });
      for (const driver of [state.d, state.p]) if (driver) await driver.shot(`FAIL-${results.length}`).catch(() => {});
    }
  }
} finally {
  await closeRig(rig).catch((error) => { failed++; console.error(error.message); });
  await writeFile(join(evidence, "results.json"), JSON.stringify(results, null, 2));
}
process.exit(failed ? 1 : 0);

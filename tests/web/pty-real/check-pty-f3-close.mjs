import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { startRig, closeRig } from "./start-rig.mjs";
import { closeRefusedSteps, hardTimeoutSteps, closeOrderSteps } from "./steps-f3-close.mjs";

// F3 close refusal (413, own fixture with a 128-byte HTTP body budget), ModelTerminals hard timeout, and ending a shell with
// the HTTP close finished before its WS closed frame, each in the real App (production build + vite preview) on its own real
// PTY fixture. Usage: S3_BROWSER_EVIDENCE=<NEW dir> node check-pty-f3-close.mjs [label...]  (default: all labels)
const evidence = process.env.S3_BROWSER_EVIDENCE;
if (!evidence) throw new Error("Set S3_BROWSER_EVIDENCE to a new evidence directory.");
const results = [];
let failed = 0;
const chains = [["close413", closeRefusedSteps, { http: { bodyBytes: 128 } }], ["timeout", hardTimeoutSteps, {}], ["closeOrder", closeOrderSteps, {}]];
const only = process.argv.slice(2);
for (const [label, steps, options] of chains.filter(([label]) => !only.length || only.includes(label))) {
  const rig = await startRig(join(evidence, label), { preview: true, ...options });
  const state = {};
  try {
    for (const [name, run] of steps(rig, state)) {
      try { await Promise.race([run(), new Promise((_, reject) => setTimeout(() => reject(new Error("step exceeded 120s")), 120000))]); results.push({ label, name, status: "PASS" }); await rig.log({ name, status: "PASS" }); }
      catch (error) {
        failed++;
        results.push({ label, name, status: "FAIL", error: error.message });
        await rig.log({ name, status: "FAIL", error: error.message });
        for (const driver of Object.values(state)) if (driver?.shot) await driver.shot(`FAIL-${results.length}`).catch(() => {});
      }
    }
    for (const driver of Object.values(state)) if (driver?.seen) await rig.log({ page: driver.name, pageErrors: driver.seen.errors, failedResponses: driver.seen.failed });
  } finally {
    await closeRig(rig).catch((error) => { failed++; console.error(`${label}: ${error.message}`); });
  }
}
await writeFile(join(evidence, "results.json"), JSON.stringify(results, null, 2));
process.exit(failed ? 1 : 0);

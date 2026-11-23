import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";

assert.equal(process.env.JUPYTER_URL, undefined, "Unset JUPYTER_URL; acceptance owns its Jupyter server");
assert.equal(process.env.JUPYTER_TOKEN, undefined, "Unset JUPYTER_TOKEN; acceptance owns its Jupyter server");
const home = await mkdtemp(join(tmpdir(), "prk-session-list-"));
const previousHome = process.env.HOME;
process.env.HOME = join(home, "user-home");
await mkdir(process.env.HOME);
initializePrkHome(home);
try {
  const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");
  const { assembleFixture } = await import("./session-messaging/assemble-fixture.mjs");
  const { seedLegacySessions } = await import("./session-messaging/seed-legacy-sessions.mjs");
  const { checkObservation } = await import("./session-messaging/check-observation.mjs");
  const { checkLiveObservation } = await import("./session-messaging/check-live-observation.mjs");
  const { checkControl } = await import("./session-messaging/check-control.mjs");
  const { checkLegacyIdentities } = await import("./session-messaging/check-legacy-identities.mjs");
  await withTargetFixture(async ({ owned, ...fixture }) => {
    assert.equal(owned, true);
    const f = await assembleFixture({ home, ...fixture, prepareHistory: seedLegacySessions });
    const owner = await f.create("Native list coordinator");
    await checkObservation(f, owner);
    await checkLiveObservation(f, owner);
    await checkLegacyIdentities(f, owner);
    await checkControl(f, owner);
  });
  console.log("PASS: real Gateway/SDK/faux native session ids, compact roster, bounded chronological live/history observation and fixed read authority, unchanged legacy JSONL; no paid model calls");
} finally {
  if (previousHome === undefined) delete process.env.HOME;
  else process.env.HOME = previousHome;
  await rm(home, { recursive: true, force: true });
}

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";

assert.equal(process.env.JUPYTER_URL, undefined, "Unset JUPYTER_URL; acceptance owns its Jupyter server");
assert.equal(process.env.JUPYTER_TOKEN, undefined, "Unset JUPYTER_TOKEN; acceptance owns its Jupyter server");
const home = await mkdtemp(join(tmpdir(), "prk-session-messaging-"));
const previousHome = process.env.HOME;
process.env.HOME = join(home, "user-home");
await mkdir(process.env.HOME);
initializePrkHome(home);
try {
  const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");
  const { assembleFixture } = await import("./session-messaging/assemble-fixture.mjs");
  const { checkDeclarations } = await import("./session-messaging/check-declarations.mjs");
  const { checkResults } = await import("./session-messaging/check-results.mjs");
  const { checkTransfer } = await import("./session-messaging/check-transfer.mjs");
  const { checkControl } = await import("./session-messaging/check-control.mjs");
  await withTargetFixture(async ({ owned, ...fixture }) => {
    assert.equal(owned, true);
    const f = await assembleFixture({ home, ...fixture });
    const owner = await checkDeclarations(f);
    await checkResults(f, owner);
    await checkTransfer(f, owner);
    await checkControl(f, owner);
  });
  console.log("PASS: real Gateway/SDK/faux declarations, receipt-driven merged result delivery/task archive, directed transfer acceptance and fixed manager authorization; no paid model calls");
} finally {
  if (previousHome === undefined) delete process.env.HOME;
  else process.env.HOME = previousHome;
  await rm(home, { recursive: true, force: true });
}

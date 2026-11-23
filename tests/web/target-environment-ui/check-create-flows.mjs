import assert from "node:assert/strict";
import { join } from "node:path";
import { assertDeployFrames } from "./record-frames.mjs";

const LONG = { timeout: 600000 };
// A started cold deploy shows real progress within seconds; only its completion may take long.
const STARTED = { timeout: 120000 };
// Scenario 2 and the failure paths of P6 on new sessions. `a` is a desktop page, `b` a phone page; both are real clients
// of the same Gateway. Every create is the original synchronous POST /api/sessions, sent only after a ready environment.
export async function checkCreateFlows({ a, b, evidence, name, api, coldCache, sessionCount, restartWeb, restartGateway }) {
  const dialog = (side) => side.page.locator('#management-dialog[data-kind="create"]');
  const panel = (side) => dialog(side).locator(".environment-progress");
  const creates = (side) => side.recorder.posts.filter((path) => path === "/api/sessions").length;
  const open = async (side) => {
    if (await side.page.locator("#open-sidebar").isVisible()) await side.page.locator("#open-sidebar").click();
    await side.page.locator(`[data-action="create-session"][data-target="${name}"]`).click();
    await dialog(side).locator("#confirm-create-session").waitFor();
  };
  const confirm = (side) => dialog(side).locator("#confirm-create-session").click();
  const created = async (side, before) => {
    // The Modal root is a zero-size box (always "hidden" to Playwright); its content leaves the DOM when it closes.
    await dialog(side).locator("#confirm-create-session").waitFor({ state: "detached", ...LONG });
    assert.equal(creates(side), before + 1, "exactly one synchronous create, after the environment was ready");
  };

  // Shared cold deploy: two pages wait on the instance's one task, then each creates its own session.
  await coldCache();
  const sessionsBefore = await sessionCount();
  await a.recorder.clearFrames(); await b.recorder.clearFrames();
  const startA = creates(a), startB = creates(b);
  await open(a); await open(b);
  // Both intents start before the cold task can finish, so both must join the one task.
  await Promise.all([confirm(a), confirm(b)]);
  const transferring = (side) => panel(side).and(side.page.locator('[data-environment-status="transferring"]:not([data-total="0"])'));
  await Promise.all([transferring(a).waitFor(STARTED), transferring(b).waitFor(STARTED)]);
  await Promise.all([
    a.page.screenshot({ path: join(evidence, "create-updating-desktop.png"), animations: "disabled" }),
    b.page.screenshot({ path: join(evidence, "create-updating-phone.png"), animations: "disabled" }),
  ]);
  await created(a, startA); await created(b, startB);
  const framesA = await a.recorder.frames(), framesB = await b.recorder.frames();
  assertDeployFrames(assert, framesA, "create page a"); assertDeployFrames(assert, framesB, "create page b");
  // One task: the same stream and total, and the two pages' transfer frames interleave in revision (no second task).
  const progressA = framesA.filter((frame) => frame.environmentStatus === "transferring" && frame.total > 0);
  const progressB = framesB.filter((frame) => frame.environmentStatus === "transferring" && frame.total > 0);
  assert.deepEqual([progressA[0].stream, progressA[0].total], [progressB[0].stream, progressB[0].total], "both pages watch one task");
  assert.ok(progressB[0].revision <= progressA.at(-1).revision && progressA[0].revision <= progressB.at(-1).revision, "the two pages' progress overlaps");
  assert.equal(await sessionCount(), sessionsBefore + 2);

  // Browser link loss: the waiting page fails its intent and never creates by itself, while the Gateway finishes.
  await coldCache();
  const lossBefore = await sessionCount();
  const lossCreates = creates(a);
  await open(a); await confirm(a);
  await transferring(a).waitFor(LONG);
  await restartWeb();
  await panel(a).and(a.page.locator('[data-failure="link-lost"]')).waitFor(LONG);
  await a.page.screenshot({ path: join(evidence, "create-link-lost-desktop.png"), animations: "disabled" });
  for (let deadline = Date.now() + 600000; (await api(`/targets/${encodeURIComponent(name)}/environment`)).status !== "ready";) {
    assert.ok(Date.now() < deadline, "the Gateway task finishes without its observer");
    await new Promise((done) => setTimeout(done, 500));
  }
  await a.page.waitForTimeout(2000);
  assert.equal(creates(a), lossCreates, "no automatic create after reconnecting");
  assert.equal(await sessionCount(), lossBefore);
  await dialog(a).locator('[data-action="retry-environment"]').click();
  await created(a, lossCreates);

  // Gateway restart mid-transfer: the task is gone (new stream, idle); the page shows a failure with an explicit retry.
  await coldCache();
  const restartBefore = await sessionCount();
  const restartCreates = creates(b);
  await open(b); await confirm(b);
  await transferring(b).waitFor(LONG);
  await restartGateway();
  await panel(b).and(b.page.locator('[data-environment-status="failed"]')).waitFor(LONG);
  await b.page.screenshot({ path: join(evidence, "create-interrupted-phone.png"), animations: "disabled" });
  assert.equal((await api(`/targets/${encodeURIComponent(name)}/environment`)).status, "idle", "a restarted Gateway does not resume the old task");
  assert.equal(creates(b), restartCreates);
  assert.equal(await sessionCount(), restartBefore);
  await dialog(b).locator('[data-action="retry-environment"]').click();
  await created(b, restartCreates);
  assert.equal(await sessionCount(), restartBefore + 1);
}

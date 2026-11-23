import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { until } from "../kernel-async-setting/create-fixture.mjs";

/**
 * Several live cells on one kernel, one float row each: a thread cell A held in a sleep and isolated cells B/C.
 * Each row shows its own mode; a directed stop of B leaves A running; an SSE reconnect keeps one row per cell;
 * while A is held stopping in its timer wait, C stays stoppable. Asserts only on data-* hooks, never on copy.
 */
export async function checkCellRows(f, shot) {
  const { page, sessionId } = f;
  const panel = page.locator("#background-tasks");
  const row = (cell) => panel.locator(`[data-task-kind="kernel"][data-task-id=${JSON.stringify(cell.cellId)}]`);
  const rowIds = () => panel.locator("[data-task-kind]").evaluateAll((rows) => rows.map((node) => node.dataset.taskId));
  const liveIds = async () => (await f.state()).kernel.activeCells.map(({ cellId }) => cellId).sort();
  const outcome = async (cell) => (await f.state()).kernelCells?.find(({ cellId }) => cellId === cell.cellId)?.outcome;
  let serial = 0;
  const start = async (title, mode, code) => {
    const result = await f.tool(`cell-rows-${++serial}`, "kernel_code", { title, mode, code, yield_s: 0 });
    assert.equal(result.status, "running");
    const cell = (await f.state()).kernel.activeCells.find(({ cellId }) => cellId === result.cell_id);
    assert.equal(cell?.mode, mode, "the snapshot reports the admitted mode");
    return cell;
  };
  const stop = async (cell) => {
    const [reply] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `/api/sessions/${encodeURIComponent(sessionId)}/kernel/interrupt`),
      row(cell).locator('[data-action="interrupt"]').click(),
    ]);
    assert.equal(reply.status(), 200);
    assert.deepEqual(reply.request().postDataJSON(), { kernelId: cell.kernelId, cellId: cell.cellId, cellOnly: true });
  };
  const loop = "import time\nwhile True: time.sleep(0.05)";
  const gate = JSON.stringify(f.gate("thread-sleep"));
  const a = await start("Thread sleeper", "thread", `import os, time\nwhile not os.path.exists(${gate}): time.sleep(0.05)\nwhile True: time.sleep(8)`);
  const b = await start("Isolated loop", "isolated", loop);
  await page.locator('#background-tasks[data-count="2"]').waitFor();
  if (await panel.getAttribute("data-open") !== "true") await page.locator("#background-tasks-toggle").click();
  for (const [cell, mode] of [[a, "thread"], [b, "isolated"]]) {
    await row(cell).waitFor({ state: "visible" });
    assert.equal(await row(cell).getAttribute("data-mode"), mode);
    assert.equal(await row(cell).getAttribute("data-status"), "running");
  }
  await shot(page, "cells-light");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.locator('html[data-mantine-color-scheme="dark"]').waitFor({ state: "attached" });
  await delay(400); // Let the scheme transition settle before the screenshot.
  await shot(page, "cells-dark");
  await page.emulateMedia({ colorScheme: "light" });

  let streams = 0;
  const counted = (reply) => { if (new URL(reply.url()).pathname === `/api/sessions/${encodeURIComponent(sessionId)}/events` && reply.status() === 200) streams++; };
  page.on("response", counted);
  await f.restartWeb(); // A real SSE drop: the Gateway and both cells stay alive.
  await until(() => streams > 0, "browser SSE reconnect");
  page.off("response", counted);
  await row(a).waitFor({ state: "visible" });
  await row(b).waitFor({ state: "visible" });
  assert.deepEqual((await rowIds()).sort(), [a.cellId, b.cellId].sort(), "reconnect keeps exactly one row per live cell");

  await stop(b);
  await row(b).waitFor({ state: "detached" });
  await until(async () => await outcome(b) === "aborted", "B records its directed stop");
  assert.equal(await row(a).getAttribute("data-status"), "running", "stopping B leaves A's row running");
  assert.deepEqual(await liveIds(), [a.cellId], "stopping B leaves A live");

  const c = await start("Isolated loop 2", "isolated", loop);
  await f.release("thread-sleep");
  await delay(500); // A is now inside time.sleep(8).
  await stop(a);
  await until(async () => await row(a).getAttribute("data-status") === "stopping" && await row(a).getAttribute("data-timer-remaining-ms") !== null, "A is held stopping in its timer wait");
  const held = { step: await row(a).getAttribute("data-blocked-step"), timerMs: Number(await row(a).getAttribute("data-timer-remaining-ms")) };
  assert(held.step && held.timerMs > 0 && held.timerMs <= 8000, `timer upper bound within the sleep: ${JSON.stringify(held)}`);
  assert.equal(await row(a).locator('[data-action="interrupt"]').isDisabled(), true, "a stopping row needs no second stop");
  assert.equal(await row(c).locator('[data-action="interrupt"]').isEnabled(), true, "a stopping row does not disable its peer");
  await shot(page, "stopping");
  await row(a).waitFor({ state: "detached", timeout: 20_000 });
  await until(async () => await outcome(a) === "aborted", "A ends aborted after its sleep");
  assert.deepEqual(await liveIds(), [c.cellId], "A's stop leaves C live");
  await stop(c);
  await panel.waitFor({ state: "detached" });
  await f.idle();
  return { modes: { thread: a.cellId, isolated: [b.cellId, c.cellId] }, held, reconnects: streams };
}

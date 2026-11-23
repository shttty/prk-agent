// Real owned target, SDK/Gateway/API/Vite/Chromium; only model decisions are faux.
// PI_TEST_WEB_EVIDENCE receives desktop collapsed/expanded and phone screenshots.
import assert from "node:assert/strict";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { until } from "../fixtures/kernel-async-setting/create-fixture.mjs";
import { createBackgroundTasksFixture } from "../fixtures/background-tasks/create-fixture.mjs";
import { checkCellRows } from "../fixtures/background-tasks/check-cell-rows.mjs";

for (const name of ["PI_TEST_PYTHON", "PI_TEST_PLAYWRIGHT", "PI_TEST_CHROMIUM", "PI_TEST_WEB_EVIDENCE"]) assert(process.env[name], `${name} is required`);
assert.equal(process.env.JUPYTER_URL, undefined);
assert.equal(process.env.JUPYTER_TOKEN, undefined);
process.env.SHELL = "/bin/bash";
const evidence = resolve(process.env.PI_TEST_WEB_EVIDENCE);
await mkdir(evidence, { recursive: true });
const title = "Background kernel", command = "sleep 600", names = [title, `alpha · ${command}`, `beta · ${command}`].sort();
const screenshots = [], stopped = [];
const panel = (page) => page.locator("#background-tasks");
const task = (page, kind, id) => panel(page).locator(`[data-task-kind=${JSON.stringify(kind)}][data-task-id=${JSON.stringify(id)}]`);
const count = (page, value) => page.locator(`#background-tasks[data-count="${value}"]`).waitFor({ state: "visible" });
const expanded = async (page, value) => {
  await until(async () => await panel(page).getAttribute("data-open") === (value ? "true" : null), `background fold=${value}`);
};
const shot = async (page, name) => {
  const path = join(evidence, `background-tasks-${name}.png`);
  await page.screenshot({ path });
  assert((await stat(path)).size > 0, `nonempty screenshot: ${path}`);
  screenshots.push(path);
};
const assertNames = async (page) => assert.deepEqual(await panel(page).locator("[data-task-kind][data-task-name]").evaluateAll((rows) => rows.map((row) => row.dataset.taskName).sort()), names);
const liveIds = async (f) => (await f.state()).kernel.activeCells.map(({ cellId }) => cellId);
let cellRows;

await withTargetFixture(async (target) => {
  const f = await createBackgroundTasksFixture(target);
  const { page, sessionId } = f;
  const select = async (view) => {
    if (await view.locator("#open-sidebar").isVisible()) await view.locator("#open-sidebar").click();
    await view.locator(`[data-session-id=${JSON.stringify(sessionId)}] .management-session-select`).click();
    await view.locator("#composer").waitFor({ state: "visible" });
  };
  const reload = async () => { await page.reload(); await select(page); await count(page, 3); };
  let cell, serial = 0;
  const commands = new Map();
  const startKernel = async (withAsk = false) => {
    const ask = withAsk ? `while not os.path.exists(${JSON.stringify(f.gate("ask-go"))}): time.sleep(0.05)\ngateway.ask(questions=[{'id':'continue','question':'Resume background fixture?','options':[{'label':'Continue'}]}])\n` : "";
    const result = await f.tool(`background-kernel-${++serial}`, "kernel_code", { title, code: `import os, time\n${ask}while True: time.sleep(0.05)`, yield_s: 0 });
    assert.equal(result.status, "running");
    cell = (await f.state()).kernel.activeCells.find(({ cellId }) => cellId === result.cell_id);
    assert(cell, "the yielded cell is in activeCells");
  };
  const startTerminal = async (name) => {
    const result = await f.tool(`background-${name}-${++serial}`, "terminal_textsend", { name, text: command, yield_s: 0 });
    assert.equal(result.status, "running");
    assert.equal(result.command, command);
    commands.set(name, result.command_id);
  };
  const viewKernel = async (view) => {
    assert.equal(await task(view, "kernel", cell.cellId).getAttribute("data-kernel-id"), cell.kernelId);
    assert.equal(await task(view, "kernel", cell.cellId).getAttribute("data-cell-id"), cell.cellId);
    const row = view.locator(`#kernel-cell-${cell.cellId}`);
    await row.waitFor({ state: "attached" });
    for (const detail of (await row.locator("xpath=ancestor-or-self::details").all()).reverse()) {
      if (await detail.evaluate((node) => node.open)) await detail.locator(":scope > summary").click();
    }
    await task(view, "kernel", cell.cellId).locator('[data-action="view"]').click();
    await until(() => row.evaluate((node) => { for (let p = node; p; p = p.parentElement) if (p.tagName === "DETAILS" && !p.open) return false; return true; }), "kernel view expands its tool and turn");
    await until(async () => {
      const box = await row.locator(":scope > summary").boundingBox();
      return box && box.y >= 0 && box.y < view.viewportSize().height;
    }, "kernel view scrolls the actual tool row into the viewport");
    assert.equal(await row.getAttribute("data-tool-returned"), "true");
  };
  const viewTerminal = async (view, name, workspace) => {
    await task(view, "terminal", name).locator('[data-action="view"]').click();
    await view.locator(`${workspace} .pi-tab[data-kind="terminal"][data-shell="${name}"][data-owner="model"]`).waitFor({ state: "visible" });
    await view.locator(`${workspace} .pi-term[data-shell="${name}"] .xterm`).waitFor({ state: "visible" });
  };
  await page.goto(f.uiUrl);
  await select(page);
  assert.equal(await panel(page).count(), 0, "empty session has no background bar");
  await startKernel(true);
  await startTerminal("alpha");
  await startTerminal("beta");
  await count(page, 3);
  await expanded(page, false);
  await shot(page, "collapsed");
  await page.locator("#background-tasks-toggle").click();
  await expanded(page, true);
  await assertNames(page);
  await shot(page, "expanded");
  await reload();
  await expanded(page, true);
  await assertNames(page);
  await page.locator("#background-tasks-toggle").click();
  await expanded(page, false);
  await reload();
  await expanded(page, false);
  assert.deepEqual(await liveIds(f), [cell.cellId], "reload retains the original live cell");
  for (const entry of await f.terminals()) if (commands.has(entry.name)) assert.equal(entry.runningCommand?.id, commands.get(entry.name), "reload retains each original terminal command");
  await page.locator("#background-tasks-toggle").click();
  await viewKernel(page);
  await viewTerminal(page, "alpha", '#desktop-stage[data-open="true"]');
  await viewTerminal(page, "beta", '#desktop-stage[data-open="true"]');
  await page.locator("#toggle-workspace").click();

  const phoneContext = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  target.onCleanup(() => phoneContext.close());
  const phone = await phoneContext.newPage();
  phone.setDefaultTimeout(30_000);
  phone.on("pageerror", (error) => f.errors.push(error.message));
  await phone.goto(f.uiUrl);
  await select(phone);
  await count(phone, 3);
  await expanded(phone, false);
  await shot(phone, "phone-collapsed");
  await phone.locator("#background-tasks-toggle").click();
  await expanded(phone, true);
  await assertNames(phone);
  await shot(phone, "phone-expanded");
  await viewKernel(phone);
  await viewTerminal(phone, "beta", "#workspace-pane");
  assert.equal(await phone.locator("#workspace-pane").getAttribute("data-compact"), "true");
  await shot(phone, "phone-terminal");
  await phone.locator("#toggle-workspace").click();
  await f.release("ask-go");
  await phone.locator('#background-tasks [data-task-kind="kernel"][data-waiting-ask="true"]').waitFor();
  await task(phone, "kernel", cell.cellId).locator('[data-action="view"]').click();
  const prompt = phone.locator('.pi-ask[data-prompt-kind="ask"]');
  await prompt.waitFor({ state: "visible" });
  const askBox = await prompt.boundingBox();
  assert(askBox && askBox.y >= 0 && askBox.y < phone.viewportSize().height, "waiting-cell view reaches the real ask prompt");
  await shot(phone, "phone-ask");
  await prompt.locator('[data-ask-option="0"]').click();
  await prompt.locator('[data-action="ask-submit"]').click();
  await prompt.waitFor({ state: "detached" });
  await until(async () => await task(phone, "kernel", cell.cellId).getAttribute("data-waiting-ask") !== "true", "answer resumes the background cell");
  assert.deepEqual(await liveIds(f), [cell.cellId]);
  await phone.close();

  const globalCancels = [];
  page.on("request", (request) => { if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/cancel")) globalCancels.push(request.url()); });
  const stop = async (kind, id) => {
    const button = task(page, kind, id).locator('[data-action="interrupt"]');
    if (kind === "kernel") {
      const [reply] = await Promise.all([page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/kernel/interrupt")), button.click()]);
      assert.equal(reply.status(), 200);
      assert.deepEqual(reply.request().postDataJSON(), { kernelId: cell.kernelId, cellId: cell.cellId, cellOnly: true });
      // The receipt is authoritative during an active turn; Pi may not deliver the SDK message until that turn ends.
      await until(async () => (await f.state()).kernelCells?.some((item) => item.cellId === id && item.outcome === "aborted"), "directed cell cancellation recorded");
    } else await button.click();
    await task(page, kind, id).waitFor({ state: "detached" });
  };
  for (const kind of ["kernel", "alpha", "beta"]) {
    await count(page, 3);
    const held = await f.hold(kind);
    const beforeCell = { ...cell }, beforeCommands = new Map(commands);
    await stop(kind === "kernel" ? "kernel" : "terminal", kind === "kernel" ? cell.cellId : kind);
    await count(page, 2);
    const snapshot = await f.state();
    assert.equal(snapshot.operation?.operationId, held.operation.operationId, "targeted stop preserves the current model operation");
    assert.equal(snapshot.state, "running");
    assert.equal(held.signal.aborted, false);
    assert.deepEqual(snapshot.kernel.activeCells.map(({ cellId }) => cellId), kind === "kernel" ? [] : [beforeCell.cellId]);
    const remaining = ["kernel", "alpha", "beta"].filter((name) => name !== kind);
    for (const name of remaining) await task(page, name === "kernel" ? "kernel" : "terminal", name === "kernel" ? beforeCell.cellId : name).waitFor({ state: "visible" });
    const terminals = await until(async () => {
      const entries = await f.terminals();
      return kind === "kernel" || !entries.find((entry) => entry.name === kind)?.runningCommand ? entries : false;
    }, "only the selected terminal command finishes");
    for (const name of ["alpha", "beta"].filter((name) => name !== kind)) {
      const entry = terminals.find((entry) => entry.name === name);
      assert.equal(entry?.runningCommand?.id, beforeCommands.get(name), "the other terminal's original command remains running");
      assert.equal(entry.runningCommand.text, command);
    }
    await held.finish();
    if (kind === "kernel") await until(async () => (await f.events(beforeCell.cellId, "finished")).some((event) => event.details.outcome === "aborted"), "SDK delivered the interrupted cell result");
    stopped.push({ kind, operationId: held.operation.operationId, foregroundCompleted: true });
    if (kind === "kernel") await startKernel();
    if (kind === "alpha") await startTerminal("alpha");
  }
  await stop("terminal", "alpha");
  await count(page, 1);
  await stop("kernel", cell.cellId);
  await panel(page).waitFor({ state: "detached" });
  await f.idle();
  cellRows = await checkCellRows(f, shot);
  await page.reload();
  await select(page);
  await panel(page).waitFor({ state: "detached" });
  assert.deepEqual(await liveIds(f), []);
  assert((await f.terminals()).every((entry) => !entry.runningCommand), "refresh leaves both stopped terminals stopped");
  assert.deepEqual(globalCancels, [], "task controls never invoke whole-turn cancellation");
  assert.deepEqual(f.errors, [], "desktop and phone render without uncaught browser errors");
});
await writeFile(join(evidence, "background-tasks.json"), JSON.stringify({ screenshots, stopped, cellRows, paidCalls: 0 }, null, 2));
console.log("background tasks: independent directed stops, foreground continuity, desktop/phone views, persistence and empty refresh passed");

// Real isolated Gateway/backend/Vite/Chromium and owned Python; only the model provider is controlled.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { parse } from "smol-toml";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { createKernelAsyncFixture, text, until } from "../fixtures/kernel-async-setting/create-fixture.mjs";
import { assertUniqueKernelRows, checkBrowserRecovery, expandKernelRow } from "../fixtures/kernel-async-setting/check-browser-recovery.mjs";

for (const name of ["PI_TEST_PYTHON", "PI_TEST_PLAYWRIGHT", "PI_TEST_CHROMIUM"]) assert(process.env[name], `${name} is required`);
assert.equal(process.env.JUPYTER_URL, undefined);
assert.equal(process.env.JUPYTER_TOKEN, undefined);
const evidence = process.env.PI_TEST_KERNEL_ASYNC_EVIDENCE || process.env.PI_TEST_WEB_EVIDENCE;
const shots = evidence ? resolve(evidence) : await mkdtemp(join(tmpdir(), "prk-kasync-shots-"));
await mkdir(shots, { recursive: true });
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR4AQEFAPr/AP8AAP8FAAH/+lyI0QAAAABJRU5ErkJggg==";
const waitCode = (path) => `while not os.path.exists(${JSON.stringify(path)}): time.sleep(0.05)`;

await withTargetFixture(async (target) => {
  const f = await createKernelAsyncFixture(target);
  const { page, sessionId } = f;
  const beforeConfig = parse(await readFile(join(f.home, "config.toml"), "utf8"));
  let navigations = 0;
  page.on("load", () => { navigations++; });
  const rowFor = (cell) => page.locator(`[data-kind="kernel-cell"][data-session-id=${JSON.stringify(sessionId)}][data-kernel-id=${JSON.stringify(cell.kernelId)}][data-cell-id=${JSON.stringify(cell.cellId)}][data-tool-call-id=${JSON.stringify(cell.toolCallId)}]`);
  const outputFor = (cell) => rowFor(cell).locator(".output-block");
  const screenshot = async (name, cell) => {
    if (cell) { await expandKernelRow(rowFor(cell)); await rowFor(cell).scrollIntoViewIfNeeded(); }
    await page.screenshot({ path: join(shots, `${name}.png`) });
  };
  const send = async (id, code) => {
    await page.locator("#composer").fill(`KERNEL_ASYNC_FIXTURE ${JSON.stringify({ id, ...(code === undefined ? {} : { code }) })}`);
    await page.locator("#send-message").click();
  };
  const openSettings = async () => {
    await page.locator("#open-settings").click();
    await page.locator('[data-settings-section="general"]').click();
    await page.locator('#setting-kernel-async-execution[data-status="ready"]').waitFor();
  };
  const setAsync = async (enabled) => {
    const control = page.locator("#setting-kernel-async-execution");
    assert.equal(await control.isChecked(), !enabled);
    const [response] = await Promise.all([
      page.waitForResponse((reply) => new URL(reply.url()).pathname === "/api/settings/kernel-execution" && reply.request().method() === "POST"),
      control.press("Space"),
    ]);
    assert.equal(response.status(), 200);
    assert.deepEqual(response.request().postDataJSON(), { asyncExecution: enabled });
    assert.deepEqual(await response.json(), { asyncExecution: enabled });
    await page.locator('#setting-kernel-async-execution[data-status="ready"]').waitFor();
    assert.equal(await control.isChecked(), enabled);
    const get = await page.request.get(`${f.apiUrl}/api/settings/kernel-execution`);
    assert.equal(get.status(), 200);
    assert.deepEqual(await get.json(), { asyncExecution: enabled });
    const after = parse(await readFile(join(f.home, "config.toml"), "utf8"));
    beforeConfig.kernel.asyncExecution = enabled;
    assert.deepEqual(after, beforeConfig, "settings preserve every unrelated TOML value");
  };
  const declared = (id, enabled) => {
    const request = f.requests.find((entry) => entry.id === id);
    assert(request, `provider receives ${id}`);
    for (const name of ["kernel_read", "kernel_interrupt"]) assert.equal(request.tools.includes(name), enabled, `${id}: ${name}`);
  };
  const running = async (id) => {
    const result = await until(() => f.results.get(id), `${id}: actual SDK running result`);
    const payload = JSON.parse(text(result));
    assert.equal(payload.status, "running");
    const cell = await until(async () => (await f.state()).kernelCells?.find((entry) => entry.toolCallId === id), `${id}: retained open cell`);
    assert.equal(cell.cellId, payload.cell_id);
    await until(async () => await rowFor(cell).getAttribute("data-tool-returned") === "true", `${id}: returned tool/live cell distinction`);
    assert.equal(await rowFor(cell).getAttribute("data-status"), "running");
    await f.idle();
    return cell;
  };
  await page.goto(f.uiUrl);
  await page.locator(`[data-session-id=${JSON.stringify(sessionId)}] .management-session-select`).click();
  await page.locator("#composer").waitFor({ state: "visible" });
  await send("old-cell", `import os, time\nprint('ASYNC_START', flush=True)\n${waitCode(f.gate("output-go"))}\nprint('NOISE_' + 'x' * 80000, flush=True)\nprint('LIVE_TAIL_AFTER_SWITCH', flush=True)\n${waitCode(f.gate("finish-go"))}\nretained_after_switch = 42\nprint('FINAL_SWITCH_OUTPUT')\ndisplay({'image/png':${JSON.stringify(png)}}, raw=True)`);
  const old = await running("old-cell");
  declared("old-cell", true);
  const initial = await f.state();
  await screenshot("running", old);
  await openSettings();
  const configPath = join(f.home, "config.toml"), savedConfig = await readFile(configPath, "utf8");
  const invalidConfig = '[kernel]\nasyncExecution = "invalid"\n';
  await writeFile(configPath, invalidConfig);
  try {
    const [rejected] = await Promise.all([
      page.waitForResponse((reply) => new URL(reply.url()).pathname === "/api/settings/kernel-execution" && reply.request().method() === "POST"),
      page.locator("#setting-kernel-async-execution").press("Space"),
    ]);
    assert(rejected.status() >= 400, "real Gateway rejects an invalid saved config");
    await page.locator('#setting-kernel-async-execution[data-status="failed"]').waitFor();
    assert.equal(await page.locator("#setting-kernel-async-execution").isChecked(), true, "failed save rolls the controlled Switch back");
    assert.equal(await readFile(configPath, "utf8"), invalidConfig, "failed save does not publish a replacement config");
    const unchanged = await page.request.get(`${f.apiUrl}/api/settings/kernel-execution`);
    assert.deepEqual(await unchanged.json(), { asyncExecution: true }, "failed save preserves live admission policy");
  } finally { await writeFile(configPath, savedConfig); }
  await setAsync(false);
  const checkpointsAtOff = (await f.events(old.cellId, "checkpoint")).length;
  await screenshot("settings");
  await page.locator("#close-settings").click();
  await send("declarations-off");
  await until(() => f.requests.some((request) => request.id === "declarations-off"), "next model request after switch off");
  await f.idle();
  declared("declarations-off", false);
  assert.deepEqual((await f.state()).kernel.activeCells.map(({ cellId }) => cellId), [old.cellId], "switch off does not stop or replace the already-yielded cell");
  await f.release("output-go");
  await expandKernelRow(rowFor(old));
  await until(async () => (await outputFor(old).textContent()).includes("LIVE_TAIL_AFTER_SWITCH")
    && await rowFor(old).getAttribute("data-truncated") === "true", "truncated live output after switch off");
  assert(Number(await rowFor(old).getAttribute("data-elapsed-ms")) > 0);
  const checkpoint = await until(async () => (await f.events(old.cellId, "checkpoint"))[checkpointsAtOff], "old-cell reminder after switch off", 70_000);
  const reminderHeader = text(checkpoint).split("\n", 1)[0];
  await until(() => f.requests.some((request) => text(request.last).includes(reminderHeader)), "reminder actually wakes the controlled model");
  const reminderRequest = f.requests.find((request) => text(request.last).includes(reminderHeader));
  for (const name of ["kernel_read", "kernel_interrupt"]) assert(!reminderRequest.tools.includes(name), `reminder wake excludes ${name}`);
  await until(async () => await rowFor(old).getAttribute("data-checkpoint-step") === String(checkpoint.details.step), "reminder projects onto the same parent row");
  await screenshot("reminder", old);
  await f.release("finish-go");
  const finished = await until(async () => (await f.events(old.cellId, "finished"))[0], "old-cell completion after switch off");
  assert.equal(finished.details.outcome, "ok");
  const completionRequest = await until(() => f.requests.find((request) => text(request.last).includes(text(finished).split("\n", 1)[0])), "native completion wakes the visual provider");
  const image = completionRequest.last.content.find((part) => part.type === "image");
  assert(image, "actual native completion model content retains ImageContent; Web snapshots stay image-free");
  await f.idle();
  await until(async () => await rowFor(old).getAttribute("data-status") === "ok", "completed parent row");
  await expandKernelRow(rowFor(old));
  const loadResult = rowFor(old).locator('[data-action="load-kernel-result"]');
  if (await loadResult.isVisible()) await loadResult.click();
  await until(async () => (await outputFor(old).textContent()).includes("FINAL_SWITCH_OUTPUT"), "actual final output instead of stale running result");
  await rowFor(old).locator('[data-action="load-kernel-image"][data-image-index="1"]').click();
  await until(async () => rowFor(old).locator('[data-kind="kernel-image"][data-image-index="1"]').evaluate((node) => { const image = node.matches("img") ? node : node.querySelector("img"); return image?.complete && image.naturalWidth > 0; }), "retained image renders in Chromium");
  const retained = await page.request.get(`${f.apiUrl}/api/sessions/${encodeURIComponent(sessionId)}/kernel/result?cellId=${encodeURIComponent(old.cellId)}&imageIndex=1`);
  assert.equal(retained.status(), 200);
  assert.deepEqual((await retained.json()).result.content.filter((part) => part.type === "image"), [image]);
  assert.equal((await f.events(old.cellId, "finished")).length, 1);
  await screenshot("finished", old);
  await assertUniqueKernelRows(page);

  await send("sync-cell", `print('SYNC_START', flush=True)\n${waitCode(f.gate("sync-go"))}\nassert retained_after_switch == 42\nprint('SYNC_DONE')`);
  await until(async () => { const state = await f.state(); return state.kernel?.state === "busy" && state.kernel.kernelId === old.kernelId && state.operation && !state.kernel.activeCells.length; }, "next synchronous admission");
  await delay(250);
  assert(!f.results.has("sync-cell"), "sync mode does not yield even with yield_s:0");
  assert(!(await f.state()).kernelCells.some((cell) => cell.toolCallId === "sync-cell"), "sync call never opens a background delivery");
  await f.release("sync-go");
  const sync = await until(() => f.results.get("sync-cell"), "synchronous final SDK result");
  assert.equal(sync.details.outcome, "ok");
  assert(text(sync).includes("SYNC_DONE"));
  declared("sync-cell", false);
  await f.idle();
  await openSettings();
  await setAsync(true);
  await page.locator("#close-settings").click();
  await send("new-cell", `import os, time\nassert retained_after_switch == 42\nprint('ASYNC_REENABLED', flush=True)\n${waitCode(f.gate("never-released"))}`);
  const current = await running("new-cell");
  declared("new-cell", true);
  assert.equal(navigations, 1, "both setting changes and the new yield need no page reload");
  assert.equal((await f.state()).streamId, initial.streamId, "hot switching does not rebuild the session");
  assert.equal(current.kernelId, old.kernelId, "hot switching preserves the owned Python namespace");
  const recovery = await checkBrowserRecovery(f, current, rowFor);
  await assertUniqueKernelRows(page);
  assert.equal(await rowFor(old).count(), 1);
  assert.equal(await rowFor(current).count(), 1);
  assert.deepEqual(f.errors, []);
  const screenshots = {};
  for (const name of ["running", "reminder", "finished", "settings"]) {
    const path = join(shots, `${name}.png`), file = await stat(path);
    assert(file.isFile() && file.size > 0, `${name}: screenshot exists`);
    screenshots[name] = { path, bytes: file.size };
  }
  await writeFile(join(shots, "kernel-async-setting.json"), JSON.stringify({ sessionId, old, current, recovery, screenshots, paidCalls: 0 }, null, 2));
  console.log(JSON.stringify({ fixture: "real Gateway/backend/Vite/Chromium/owned Python", asyncOff: true, nextRequestToolsHidden: true, reminderWakeToolsHidden: true, retainedImage: true, syncYieldZeroWaits: true, asyncOnWithoutReload: true, oneRowPerIdentity: true, recovery, screenshots, paidCalls: 0 }));
});

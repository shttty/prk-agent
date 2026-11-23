// Real owned target with the fixture's Bun artifact, SDK/Gateway/API/Vite/Chromium; only model decisions are faux.
// 会话详情 kernel language: blocked while a cell runs, confirm-then-switch to Bun answered by the server,
// persistent across reopening, and every result row keeps the language it ran in.
import assert from "node:assert/strict";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { until } from "../fixtures/kernel-async-setting/create-fixture.mjs";
import { createBackgroundTasksFixture } from "../fixtures/background-tasks/create-fixture.mjs";

for (const name of ["PI_TEST_PYTHON", "PI_TEST_PLAYWRIGHT", "PI_TEST_CHROMIUM", "PI_TEST_WEB_EVIDENCE"]) assert(process.env[name], `${name} is required`);
process.env.SHELL = "/bin/bash";
const evidence = resolve(process.env.PI_TEST_WEB_EVIDENCE);
await mkdir(evidence, { recursive: true });
const screenshots = [];
let switched;

await withTargetFixture(async (target) => {
  const f = await createBackgroundTasksFixture(target);
  const { page, sessionId } = f;
  const row = page.locator(`[data-session-id=${JSON.stringify(sessionId)}]`);
  const control = page.locator("#kernel-language");
  const shot = async (name) => {
    const path = join(evidence, `kernel-language-${name}.png`);
    await page.screenshot({ path });
    assert((await stat(path)).size > 0, `nonempty screenshot: ${path}`);
    screenshots.push(path);
  };
  const openDetails = async () => {
    await row.locator('[data-action="session-menu"]').click();
    await page.locator("#session-details").click();
    await control.waitFor({ state: "visible" });
    await control.scrollIntoViewIfNeeded();
  };
  const closeDetails = async () => {
    await page.locator("#close-session-details").click();
    await control.waitFor({ state: "detached" });
  };
  const status = (value) => until(async () => await control.getAttribute("data-status") === value, `language control ${value}`);
  const outcome = async (cellId) => (await f.state()).kernelCells?.find((cell) => cell.cellId === cellId)?.outcome;
  const cellRow = (cellId) => page.locator(`#kernel-cell-${cellId}`);

  await page.goto(f.uiUrl);
  await row.locator(".management-session-select").click();
  await page.locator("#composer").waitFor({ state: "visible" });
  const pythonGate = JSON.stringify(f.gate("python-go"));
  const python = await f.tool("python-cell", "kernel_code", { title: "Python cell", code: `import os, time\nwhile not os.path.exists(${pythonGate}): time.sleep(0.05)\n'PYTHON_DONE'`, yield_s: 0 });
  assert.equal(python.status, "running");

  await openDetails();
  await status("running");
  assert.equal(await control.getAttribute("data-value"), "python");
  assert.equal(await control.locator('input[value="bun"]').isDisabled(), true, "a running cell blocks the switch");
  await shot("running");
  await closeDetails();
  await f.release("python-go");
  await until(async () => await outcome(python.cell_id) === "ok", "the Python cell finishes");
  await f.idle();

  await openDetails();
  await status("ready");
  await control.locator('[data-language="bun"]').click();
  const confirm = page.locator("#confirm-kernel-language");
  await confirm.waitFor({ state: "visible" });
  assert.equal(await control.getAttribute("data-value"), "python", "nothing changes before confirmation");
  await shot("confirm-light");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.locator('html[data-mantine-color-scheme="dark"]').waitFor({ state: "attached" });
  await delay(400); // Let the scheme transition settle before the screenshot.
  await shot("confirm-dark");
  await page.emulateMedia({ colorScheme: "light" });
  const [reply] = await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `/api/sessions/${encodeURIComponent(sessionId)}/native`),
    confirm.click(),
  ]);
  assert.deepEqual(reply.request().postDataJSON().args, { language: "bun" });
  switched = (await reply.json()).data;
  assert.equal(switched.language, "bun");
  await until(async () => await control.getAttribute("data-value") === "bun", "the server's answer selects Bun");
  await confirm.waitFor({ state: "detached" });
  assert.equal((await f.state()).kernelLanguage, "bun");
  await closeDetails();
  await openDetails();
  assert.equal(await control.getAttribute("data-value"), "bun", "reopened details still show Bun");
  await shot("bun");
  await closeDetails();

  const bunGate = JSON.stringify(f.gate("bun-go"));
  const bun = await f.tool("bun-cell", "kernel_code", { title: "Bun cell", code: `const fs = await import("node:fs");\nwhile (!fs.existsSync(${bunGate})) await Bun.sleep(50);\n"BUN_DONE"`, yield_s: 0 });
  assert.equal(bun.status, "running");
  await until(async () => await cellRow(bun.cell_id).getAttribute("data-language") === "bun", "the new cell row is Bun");
  await f.release("bun-go");
  await until(async () => await outcome(bun.cell_id) === "ok", "the Bun cell finishes");
  assert.equal(await cellRow(python.cell_id).getAttribute("data-language"), "python", "the old result row keeps Python");
  assert.deepEqual(f.errors, [], "no uncaught browser errors");
});
await writeFile(join(evidence, "kernel-language.json"), JSON.stringify({ screenshots, switched, paidCalls: 0 }, null, 2));
console.log("session kernel language: busy refusal, confirmed switch, persistence and per-row language passed");

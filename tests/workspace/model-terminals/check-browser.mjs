import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { startWebApplication } from "../../../src/http/application/start-application.ts";
import { startWebDev } from "../../fixtures/web-dev.mjs";
import { loadChromium } from "../../fixtures/workspace-mock/load-chromium.mjs";

export async function checkModelTerminalBrowser({ sessionId: worker, socket, onCleanup, call }) {
  let web, ui, browser;
  onCleanup(async () => {
    const failures = [];
    for (const close of [() => browser?.close(), () => ui?.close(), () => web?.close()]) {
      try { await close(); } catch (error) { failures.push(error); }
    }
    if (failures.length) throw new AggregateError(failures, "Model-terminal browser cleanup failed");
  });
  web = await startWebApplication({ socket, host: "127.0.0.1", port: 0 });
  const listingResponse = await fetch(`${web.server.url}/api/sessions/${worker}/terminals`);
  assert.equal(listingResponse.status, 200);
  const listing = await listingResponse.json();
  const modelTab = listing.terminals.find(({ name }) => name === "main");
  assert.equal(modelTab.owner, "model");
  assert.equal(modelTab.label, "main");
  ui = await startWebDev(web.server.url);
  browser = await loadChromium();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(ui.url);
  await page.locator(`[data-session-id="${worker}"] .management-session-select`).click();
  await page.locator("#composer").waitFor();
  await page.keyboard.press("Control+j");
  await page.locator('.pi-tab[data-shell="main"][data-owner="model"]').waitFor();
  await page.locator('#desktop-stage .pi-term[data-shell="main"] .xterm').waitFor();
  await page.locator('.pi-terminal-event[data-kind="quiet"]').first().waitFor({ state: "attached" });
  await page.locator('.pi-terminal-event[data-kind="done"]').first().waitFor({ state: "attached" });
  assert.deepEqual(errors, [], "real terminal and event presentation render without page errors");
  await page.locator('.pi-terminal-event[data-kind="quiet"]').first().scrollIntoViewIfNeeded();
  const evidence = process.env.PI_TEST_WEB_EVIDENCE ?? ".smart-cascade/control/model-terminals";
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: join(evidence, "terminal.png"), fullPage: true });
  await checkBackgroundInterrupt({ page, webUrl: web.server.url, sessionId: worker, call });
  await page.locator("#open-settings").click();
  await page.locator('[data-settings-section="tools"]').click();
  await page.locator('.capabilities-panel[data-kind="tools"][aria-busy="false"]').waitFor();
  const provider = "group:tools:package:<inline:terminals>";
  await page.locator(`#tools-sources [data-provider="${provider}"] .capability-provider-name`).click();
  await page.locator(`.capability-detail-host > .pi-fade-live [data-action="open-config"][data-provider="${provider}"]`).click();
  const toggle = page.locator('#plugin-config[aria-hidden="false"] [data-config-field="quietNotifyDefault"] input');
  assert.equal(await toggle.isChecked(), false);
  await page.locator('#plugin-config[aria-hidden="false"] [data-config-field="quietNotifyDefault"] .mantine-Switch-track').click();
  await page.locator('#plugin-config[aria-hidden="false"]').screenshot({ path: join(evidence, "terminal-quiet-settings.png") });
  await page.locator('#config-pending[data-count="1"] [data-action="config-write"]').click();
  await page.locator("#config-pending").waitFor({ state: "detached" });
  assert.equal((await (await fetch(`${web.server.url}/api/capabilities`)).json()).terminal.quietNotifyDefault, true);
  assert.deepEqual(errors, [], "terminal settings render and save without page errors");
  await page.close();
}

async function checkBackgroundInterrupt({ page, webUrl, sessionId, call }) {
  const route = `/api/sessions/${sessionId}/terminals`;
  const name = "main";
  const command = await call("terminal_textsend", { name, text: "trap '' INT; printf '%s%s\\n' INTERRUPT_ READY; sleep 60", yield_s: 0 });
  assert.equal(command.status, "running");
  const ready = await call("terminal_read", { name, yield_s: 1 });
  assert.match(ready.output, /INTERRUPT_READY/u, "the command installed its SIGINT trap before the interrupt");
  const list = async () => (await (await fetch(webUrl + route)).json()).terminals;
  const before = (await list()).find((terminal) => terminal.name === name);
  const target = { name, generation: before.generation, commandId: command.command_id };
  const request = async (params) => {
    const response = await fetch(`${webUrl}${route}/interrupt`, { method: "POST", headers: { Origin: webUrl, "Content-Type": "application/json" }, body: JSON.stringify(params) });
    assert.equal(response.status, 200);
    return response.json();
  };
  assert.deepEqual(await request({ ...target, generation: "stale-generation" }), { requested: false });
  assert.deepEqual(await request({ ...target, commandId: "stale-command" }), { requested: false });
  await page.locator("#background-tasks-toggle[aria-expanded=false]").click();
  const row = page.locator(`[data-task-kind="terminal"][data-task-id="${name}"]`);
  const [response] = await Promise.all([
    page.waitForResponse((reply) => reply.request().method() === "POST" && new URL(reply.url()).pathname === `${route}/interrupt`),
    row.locator('[data-action="interrupt"]').click(),
  ]);
  assert.deepEqual(response.request().postDataJSON(), target);
  assert.equal(response.status(), 200);
  assert.deepEqual(await response.json(), { requested: true });
  await row.waitFor({ state: "detached" });
  await page.waitForFunction(async ({ route, name, generation }) => {
    const { terminals } = await (await fetch(route)).json();
    return terminals.some((terminal) => terminal.name === name && terminal.generation !== generation && !terminal.runningCommand);
  }, { route, name, generation: before.generation });
  const ended = await call("terminal_read", { command: command.command_id });
  assert.equal(ended.status, "killed");
  assert.equal(ended.exit_code, null);
}

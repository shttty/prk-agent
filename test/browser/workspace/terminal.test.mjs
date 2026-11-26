import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { browserFixture } from "../../fixtures/browser/open-workbench.mjs";
import { checkProcessPanel } from "./check-process-panel.mjs";
import { layoutRootsDuringComposition } from "./trace-ime-layout.mjs";

const shell = '.pi-term[data-shell="shell"]';

async function openWorkspace(page) {
  const toggle = page.locator("#toggle-workspace");
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
}

async function openTerminal(page) {
  await openWorkspace(page);
  const terminal = page.locator(shell);
  await terminal.locator('.pi-term-view[data-status="connected"]').waitFor();
  await terminal.locator(".xterm-cursor").waitFor();
  return terminal;
}

test("Chromium terminal IME lays out inside xterm, commits Chinese and interrupts a PTY command", async (t) => {
  const f = await browserFixture(t);
  const id = await f.create();
  await f.open(id);
  const keyboard = f.page.keyboard;
  const monitor = f.page.locator("#monitor-card");
  await monitor.waitFor();
  const received = Promise.withResolvers();
  const resume = Promise.withResolvers();
  t.after(() => resume.resolve());
  await f.page.route(`**/api/sessions/${id}/terminals`, async (route) => {
    const reply = await route.fetch();
    received.resolve();
    await resume.promise;
    await route.fulfill({ response: reply });
  }, { times: 1 });
  await keyboard.press("Control+j");
  await received.promise;
  await f.page.locator("#new-terminal").click();
  const tab = f.page.locator('.pi-tab[data-kind="terminal"][data-shell="shell"]');
  await tab.waitFor();
  resume.resolve();
  const terminal = await openTerminal(f.page);
  const input = terminal.locator("textarea.xterm-helper-textarea");
  await f.page.evaluate(() => document.fonts.ready);
  await input.focus();
  await keyboard.insertText("printf '\\nVERIFIED=<%s>\\n' '");
  const cdp = await f.page.context().newCDPSession(f.page);
  const preedit = terminal.locator(".composition-view.active");
  const words = "你好终端";
  const marker = await layoutRootsDuringComposition(cdp, async () => {
    for (const value of ["n", "ni", "ni hao", "你好", words]) {
      await cdp.send("Input.imeSetComposition", { text: value, selectionStart: value.length, selectionEnd: value.length });
      await f.page.evaluate(() => new Promise((done) => requestAnimationFrame(done)));
    }
  }, shell);
  assert(marker.length > 0 && marker.every(Boolean), `IME layout roots must be inside xterm: ${JSON.stringify(marker)}`);
  await preedit.waitFor();
  assert.equal((await preedit.textContent()).replaceAll("\u200E", ""), words);
  const box = await preedit.boundingBox(), screen = await terminal.locator(".xterm-screen").boundingBox();
  assert(box.x >= screen.x && box.x + box.width <= screen.x + screen.width + 1);
  await cdp.send("Input.insertText", { text: words });
  await preedit.waitFor({ state: "hidden" });
  await keyboard.insertText("'");
  await keyboard.press("Enter");
  const output = terminal.locator(".xterm-rows");
  await output.filter({ hasText: `VERIFIED=<${words}>` }).waitFor();
  await keyboard.insertText(`printf TERMINAL_STARTED; sleep 60; printf 'EXIT-%s' "$?"`);
  await keyboard.press("Enter");
  await terminal.locator(".xterm-rows > div").filter({ hasText: /^TERMINAL_STARTED\s*$/ }).waitFor();
  await keyboard.press("Control+c");
  await keyboard.insertText(`printf 'INTERRUPT-%s' "$?"`);
  await keyboard.press("Enter");
  await output.filter({ hasText: "INTERRUPT-130" }).waitFor();
});

test("file tree uploads a multi-megabyte file and downloads its target bytes", async (t) => {
  const f = await browserFixture(t, { viewport: { width: 1920, height: 1000 }, config: { monitor: { enabled: true, fastIntervalMs: 500, slowIntervalMs: 500 } } });
  const name = "payload.bin";
  const path = join(f.cwd, name);
  const bytes = randomBytes(4 * 1024 ** 2);
  const id = await f.create();
  await f.open(id);
  await f.page.locator("#monitor-card").waitFor();
  await f.page.locator("#monitor-machine").waitFor({ timeout: 3000 });
  assert.equal(await f.page.locator('[data-monitor-fold][data-open="true"]').count(), 0);
  await openWorkspace(f.page);
  const tree = f.page.locator("#toggle-tree");
  if (await tree.isVisible() && await tree.getAttribute("aria-pressed") !== "true") await tree.click();
  await f.page.locator("#files-new").click();
  const chooser = f.page.waitForEvent("filechooser");
  await f.page.locator('[data-action="upload"]').click();
  await (await chooser).setFiles({ name, mimeType: "application/octet-stream", buffer: bytes });
  await f.page.locator(`#files-panel li[data-path="${path}"] .pi-files-line`).click({ button: "right" });
  assert.equal(await f.page.locator("#monitor-card").isVisible(), false, "the open file tree must not cover the monitor");
  const pending = f.page.waitForEvent("download");
  await f.page.locator('[data-action="download"]').click();
  const downloaded = await pending;
  assert.equal(downloaded.suggestedFilename(), name);
  assert.equal(await downloaded.failure(), null);
  assert((await readFile(await downloaded.path())).equals(bytes));
  await f.page.locator("#toggle-monitor").click();
  await f.page.locator('#toggle-workspace[aria-expanded="false"]').waitFor();
  await f.page.locator("#monitor-card").waitFor();
  await checkProcessPanel(f, id);
});

const endShell = (page, id, name) => page.evaluate(({ id, name }) => fetch(`/api/sessions/${id}/terminals/close`, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }),
}).then((reply) => reply.status), { id, name });

test("cursor blink survives animation toggles; a gone restored shell and the new-terminal button each bring a live shell", async (t) => {
  const f = await browserFixture(t);
  const id = await f.create();
  await f.open(id);
  const terminal = await openTerminal(f.page);
  const input = terminal.locator("textarea.xterm-helper-textarea");
  const blinking = terminal.locator(".xterm-cursor.xterm-cursor-blink");
  const motion = f.page.locator("#setting-no-animation");
  const reduced = f.page.locator("html[data-no-animation]");
  const open = async () => {
    await f.page.locator("#open-settings").click();
    await f.page.locator("#open-visual-effects").click();
  };
  const close = () => f.page.locator("#close-settings").click();
  await open();
  const blink = f.page.locator("#setting-terminal-cursor-blink");
  const label = f.page.locator('label.pi-settings-title[for="setting-terminal-cursor-blink"]');
  if (!await blink.isChecked()) await label.click();
  assert.equal(await blink.isChecked(), true);
  await close();
  await input.focus();
  await blinking.waitFor();
  await open();
  await motion.press("Space");
  await reduced.waitFor();
  await close();
  await input.focus();
  await blinking.waitFor({ state: "detached" });
  assert.equal(await f.page.evaluate(() => document.getAnimations().length), 0);
  await open();
  assert.equal(await blink.isChecked(), true);
  await motion.press("Space");
  await reduced.waitFor({ state: "detached" });
  await close();
  await input.focus();
  await blinking.waitFor();
  // The saved layout restores a shell tab the server no longer has (as after a Gateway restart): a new shell replaces it.
  await f.page.goto("about:blank");
  await f.request("terminalClose", { sessionId: id, name: "shell" });
  await f.open(id);
  await openTerminal(f.page);
  // An empty workspace with the directory popover open: the new-terminal button opens a shell, the workspace stays open.
  await f.page.locator("#toggle-tree").click();
  await f.page.locator("#file-tree:not([hidden])").waitFor();
  assert.equal(await endShell(f.page, id, "shell"), 200);
  await f.page.locator(".pi-term").waitFor({ state: "detached" });
  await f.page.locator("#new-terminal").click();
  await f.page.locator('.pi-term .pi-term-view[data-status="connected"]').waitFor();
  assert.equal(await f.page.locator("#toggle-workspace").getAttribute("aria-expanded"), "true");
});

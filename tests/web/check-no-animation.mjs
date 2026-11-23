import assert from "node:assert/strict";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";

const server = await startWebDev("http://127.0.0.1:9");
let browser;
try {
  browser = await loadChromium();
  const { page, problems } = await openMockWorkbench(browser, server.url, {
    search: "#sessionId=w1", storage: { "pi.layout.workspaceOpen": "true", "pi-terminal-cursor-blink": "true" },
    terminals: [{ name: "shell", owner: "user" }], terminalReplay: "$ ",
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const terminal = page.locator('.pi-term[data-shell="shell"]');
  await terminal.locator('.pi-term-view[data-status="connected"]').waitFor();
  const input = terminal.locator("textarea.xterm-helper-textarea");
  const blinking = terminal.locator(".xterm-cursor.xterm-cursor-blink");
  const root = page.locator("html[data-no-animation]");
  const setting = page.locator("#setting-no-animation");
  const openSettings = () => page.locator("#open-settings").click();
  const closeSettings = () => page.locator("#close-settings").click();
  await input.focus();
  await blinking.waitFor();
  assert.equal(await root.count(), 0, "no-animation mode defaults off");
  await openSettings();
  assert.equal(await setting.isChecked(), false);
  await setting.focus();
  await setting.press("Space");
  await root.waitFor();
  assert.equal(await setting.isChecked(), true);
  await page.locator('[data-settings-section="archive"]').click();
  await page.locator('#settings-content[data-section="archive"]').waitFor();
  assert.equal(await page.locator(".pi-fade-leaving").count(), 0, "settings page does not leave an animated clone");
  const modal = await page.locator("#settings-dialog").evaluate((node) => ({
    transition: getComputedStyle(node).transitionProperty, duration: getComputedStyle(node).transitionDuration,
  }));
  assert.deepEqual(modal, { transition: "none", duration: "0s" });
  await closeSettings();
  await input.focus();
  await assertStill(page, blinking);
  assert.equal(await page.evaluate(() => localStorage.getItem("pi-no-animation")), "true");

  await openSettings();
  await setting.focus();
  await setting.press("Space");
  await root.waitFor({ state: "detached" });
  await closeSettings();
  await input.focus();
  await blinking.waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem("pi-terminal-cursor-blink")), "true", "overriding blinking does not overwrite its preference");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await root.waitFor();
  await assertStill(page, blinking);
  assert.equal(await page.evaluate(() => localStorage.getItem("pi-no-animation")), "false", "system preference does not overwrite the switch");
  assert.deepEqual(problems, []);
  console.log("PASS no animation: switch and system reduced motion stop CSS/WAAPI animations and terminal blinking; turning it off restores the saved cursor preference");
} finally {
  await browser?.close();
  await server.close();
}

async function assertStill(page, blinking) {
  await blinking.waitFor({ state: "detached" });
  assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
  assert.equal(await page.locator("#transcript").evaluate((node) => getComputedStyle(node).scrollBehavior), "auto");
}

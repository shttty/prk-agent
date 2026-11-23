import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { startWebApplication } from "../../src/http/application/start-application.ts";
import { startWebDev } from "./web-dev.mjs";


/** 接回 kernel lives in the session menu (closed workers show no banner). */
async function recoverFromMenu(page) {
  if (await page.locator("#open-sidebar").isVisible()) await page.locator("#open-sidebar").click();
  await page.locator('[data-session-id][aria-current="true"]').locator('[data-action="session-menu"]').click();
  await page.locator("#recover-kernel").click();
  const drawer = page.getByRole("dialog");
  if (await drawer.isVisible()) { await page.keyboard.press("Escape"); await drawer.waitFor({ state: "hidden" }); }
}
const CLOSED_WORKER = () => document.querySelector("#composer")?.getAttribute("data-status") === "closed";

export async function createRecoveryBrowser() {
  const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
  const evidence = resolve(process.env.PI_TEST_WEB_EVIDENCE ?? ".smart-cascade/control/recovery-browser");
  await mkdir(evidence, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let web;
  let ui;
  let worker;
  let port = 0;

  async function select(sessionId) {
    if (await page.locator("#open-sidebar").isVisible() && await page.locator("#open-sidebar").getAttribute("aria-expanded") === "false") await page.locator("#open-sidebar").click();
    const button = page.locator(`[data-session-id="${sessionId}"]`);
    await button.waitFor({ state: "attached" });
    await button.click();
    // Session actions live on the selected sidebar row; selecting closes the phone drawer, so reopen it.
    if (await page.locator("#open-sidebar").isVisible()) await page.locator("#open-sidebar").click();
    await page.locator('[data-session-id][aria-current="true"]').locator('[data-action="session-menu"]').click();
    await page.locator("#session-details").click();
    await page.waitForFunction((id) => document.querySelector("#session-id")?.textContent?.includes(id), sessionId);
    await page.locator("#close-session-details").click();
    await page.locator("#session-id").waitFor({ state: "hidden" });
    const drawer = page.getByRole("dialog");
    if (await drawer.isVisible()) { await page.keyboard.press("Escape"); await drawer.waitFor({ state: "hidden" }); }
    await page.waitForFunction(CLOSED_WORKER);
  }

  async function screenshot(name) {
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Recovery controls do not overflow the viewport");
    await page.screenshot({ path: join(evidence, `${name}.png`), fullPage: false, animations: "disabled" });
  }


  return {
    async open(socket, sessionId, phone = false) {
      await web?.close();
      web = await startWebApplication({ socket, host: process.env.PI_TEST_WEB_HOST ?? "127.0.0.1", port });
      port = Number(new URL(web.server.url).port);
      // One UI dev server for the whole fixture; every reopened API listener
      // comes back on the same port, where its /api proxy points.
      ui ??= await startWebDev(web.server.url, { host: process.env.PI_TEST_WEB_HOST ?? "127.0.0.1" });
      worker = sessionId;
      await page.setViewportSize(phone ? { width: 390, height: 844 } : { width: 1280, height: 900 });
      await page.goto(ui.url);
      await select(sessionId);
    },
    /** The single "接回 kernel" action (mode auto): reconnect when possible, otherwise a new kernel. */
    async recover() {
      const response = page.waitForResponse((value) => new URL(value.url()).pathname === `/api/sessions/${worker}/recover` && value.request().method() === "POST");
      await recoverFromMenu(page);
      const result = await response;
      assert.equal(result.status(), 200);
      assert.deepEqual(result.request().postDataJSON(), { mode: "auto" });
      const value = await result.json();
      // Worker composers stay sendable whatever the outcome; a failed attempt only shows an error banner.
      await page.waitForFunction(() => { const composer = document.querySelector("#composer"); return composer && !composer.disabled && !composer.readOnly; });
      await screenshot(`${page.viewportSize().width}-${value.session.recovery.status}`);
      return value;
    },
    screenshot,
    async close() {
      const outcomes = await Promise.allSettled([browser.close(), ui?.close(), web?.close()]);
      const failed = outcomes.filter((outcome) => outcome.status === "rejected");
      if (failed.length) throw new AggregateError(failed.map((outcome) => outcome.reason), "Recovery browser cleanup failed");
      assert.deepEqual(errors, [], "No recovery browser script errors");
    },
  };
}

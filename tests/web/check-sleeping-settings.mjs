import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { withSleepSettingsFixture } from "../sessions/sleepset/assemble-fixture.mjs";
import { checkBrowserSleepingSettings } from "../sessions/sleepset/check-browser-settings.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { connectWebGateway } from "../../src/http/gateway-connection/connect-gateway.ts";
import { startWebServer } from "../../src/http/listener/start-listener.ts";

assert(process.env.PI_TEST_WEB_EVIDENCE, "Set PI_TEST_WEB_EVIDENCE to the owned task evidence directory");
const evidence = resolve(process.env.PI_TEST_WEB_EVIDENCE);
await mkdir(evidence, { recursive: true });
const fallback = process.argv.includes("--fallback");
await withSleepSettingsFixture(async (f) => {
  const sessions = [await f.create("Sleeping settings desktop"), await f.create("Sleeping settings phone")];
  if (fallback) {
    await f.stop();
    for (const sessionId of sessions) await f.markUnavailable(sessionId);
    await f.start();
  }
  const adapter = await connectWebGateway({ socket: f.socket });
  let web, ui, browser;
  try {
    web = await startWebServer(adapter, { host: "127.0.0.1", port: 0, home: f.home });
    ui = await startWebDev(web.url);
    browser = await loadChromium();
    for (const [index, device, viewport, colorScheme] of [[0, "desktop", { width: 1440, height: 900 }, "light"], [1, "phone", { width: 390, height: 844 }, "dark"]]) {
      const context = await browser.newContext({ viewport, colorScheme, isMobile: device === "phone", hasTouch: device === "phone" });
      const page = await context.newPage(), problems = [];
      page.on("pageerror", (error) => problems.push(error.message));
      const click = (locator) => device === "phone" ? locator.tap() : locator.click();
      const shot = (suffix) => page.screenshot({ path: join(evidence, `sleepset-${device}-${suffix}.png`), fullPage: true, animations: "disabled" });
      try {
        await page.goto(ui.url);
        if (device === "phone") await click(page.locator("#open-sidebar"));
        await click(page.locator(`[data-session-id="${sessions[index]}"] .management-session-select`));
        const scene = { f, page, sessionId: sessions[index], device, click, shot };
        if (fallback) {
          const { checkBrowserModelFallback } = await import("../sessions/sleepset/check-browser-fallback.mjs");
          await checkBrowserModelFallback(scene);
        } else await checkBrowserSleepingSettings(scene);
        assert.deepEqual(problems, [], `${device}: zero browser page errors`);
      } finally { await context.close(); }
    }
  } finally {
    await browser?.close();
    await ui?.close();
    await web?.close();
    await adapter.close();
  }
}, { idleTimeoutMs: 800 });
console.log(`PASS real desktop/phone ${fallback ? "visible model fallback" : "sleeping settings"}; screenshots ${evidence}`);

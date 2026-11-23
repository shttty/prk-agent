import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { startGateway } from "../../../src/gateway/socket-server/start-listener.ts";

export async function checkIdleBrowser({ browserSegment, host, tempRoot, onCleanup, complete, send, snapshot, busy, get, userTexts, delay }) {
  if (browserSegment) {
    const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
    const { startWebApplication } = await import("../../../src/http/application/start-application.ts");
    const { startWebDev } = await import("../../fixtures/web-dev.mjs");
    const browser = await chromium.launch({ headless: true, executablePath: process.env.PI_TEST_CHROMIUM });
    const uiSocket = join(tempRoot, "idle-browser.sock");
    const uiGateway = await startGateway(host, uiSocket);
    let uiWeb = await startWebApplication({ socket: uiSocket, host: "127.0.0.1", port: 0 });
    const ui = await startWebDev(uiWeb.server.url);
    onCleanup(async () => { await browser.close(); await ui.close(); await uiWeb.close(); await uiGateway.close(); });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const uiMain = (await host.createSession({ target: "local", label: "Browser idle recovery" })).session.sessionId;
    await complete(await send(uiMain, "UI_BEFORE_SLEEP"));
    const uiSessionId = snapshot(uiMain).sessionId;
    await page.goto(ui.url, { waitUntil: "domcontentloaded" });
    await page.locator(`[data-session-id=${JSON.stringify(uiMain)}] .management-session-select`).click();
    let uiPosts = 0;
    page.on("request", (request) => { if (request.method() === "POST" && new URL(request.url()).pathname === `/api/sessions/${uiMain}/send`) uiPosts++; });
    for (const round of [1, 2]) {
      await page.waitForFunction(() => document.querySelector('header .topbar-status[data-status="sleeping"]') !== null);
      assert.equal(await page.locator("#composer").isDisabled(), false);
      const eventsRoute = `**/api/sessions/${uiMain}/events`;
      if (round === 2) {
        await page.route(eventsRoute, (route) => route.abort("failed"));
        const port = Number(new URL(uiWeb.server.url).port);
        await uiWeb.close();
        await page.locator('#management-connection-status[data-status="connecting"]').waitFor({ state: "visible" });
        uiWeb = await startWebApplication({ socket: uiSocket, host: "127.0.0.1", port });
      }
      await page.locator("#composer").fill(`UI_WAKE_${round}`);
      const admitted = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `/api/sessions/${uiMain}/send`);
      await page.locator("#composer").press("Enter");
      await page.locator("#composer").press("Enter");
      assert.equal((await (await admitted).json()).accepted, true);
      if (round === 2) await page.unroute(eventsRoute);
      await page.waitForFunction((expected) => document.querySelectorAll(".pi-message-user").length === expected && document.querySelector("#composer")?.value === "", round + 1).catch(async (error) => {
        const browserState = await page.evaluate(() => ({ draft: document.querySelector("#composer")?.value, users: [...document.querySelectorAll(".pi-message-user")].map((node) => node.textContent), status: document.querySelector("#composer")?.getAttribute("data-status") }));
        throw new Error(`Browser wake ${round} did not render exactly ${round + 1} user messages and clear the composer: ${JSON.stringify({ browser: browserState, savedUsers: userTexts(snapshot(uiMain)) })}`, { cause: error });
      });
      assert.equal(uiPosts, round, "one admission per new message across repeated sleep and display reconnection");
      assert.equal(snapshot(uiMain).sessionId, uiSessionId);
    }
    assert.deepEqual(userTexts(snapshot(uiMain)), ["UI_BEFORE_SLEEP", "UI_WAKE_1", "UI_WAKE_2"]);
    // Selection only reads the sleeping session; the first SSE snapshot supplies its history.
    await page.waitForFunction(() => document.querySelector('header .topbar-status[data-status="sleeping"]') !== null);
    await page.locator(`[data-session-id=${JSON.stringify(busy)}] .management-session-select`).click();
    await page.waitForFunction((name) => document.querySelector(`[data-session-id=${JSON.stringify(name)}]`)?.getAttribute("aria-current") === "true", busy);
    const eventsRoute = `**/api/sessions/${uiMain}/events`;
    await page.route(eventsRoute, async (route) => { await delay(800); await route.continue(); });
    await page.locator(`[data-session-id=${JSON.stringify(uiMain)}] .management-session-select`).click();
    await page.locator("#history-loading").waitFor({ state: "visible" });
    await page.locator("#history-loading").waitFor({ state: "hidden" });
    await page.unroute(eventsRoute);
    assert.equal(get(uiMain).state, "sleeping", "selecting sleeping history does not wake its runtime");
    await page.waitForFunction(() => document.querySelector('header .topbar-status[data-status="sleeping"]') !== null);
    assert.equal(uiPosts, 2, "selecting sleeping history sends no message");
    assert.deepEqual(userTexts(snapshot(uiMain)), ["UI_BEFORE_SLEEP", "UI_WAKE_1", "UI_WAKE_2"]);
    console.log("PASS repeated browser sleep/wake plus detached SSE: authoritative snapshot sequence reset, same identity, editable sleeping draft and no duplicate admission.");
  }
}

import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { closeSessionDetails, openSessionDetails } from "../../fixtures/session-details.mjs";

export async function checkBrowserSettings({ socket, onCleanup, client, home, gates, host, requests, current, completed, until }) {
    if (process.env.PI_TEST_PLAYWRIGHT && process.env.PI_TEST_CHROMIUM) {
      const { pathToFileURL } = await import("node:url");
      const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
      const { connectWebGateway } = await import("../../../src/http/gateway-connection/connect-gateway.ts");
      const { startWebServer } = await import("../../../src/http/listener/start-listener.ts");
      const { startWebDev } = await import("../../fixtures/web-dev.mjs");
      const webClient = await connectWebGateway({ socket });
      const web = await startWebServer(webClient, { host: "127.0.0.1", port: 0 });
      const ui = await startWebDev(web.url);
      const browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, args: ["--no-sandbox"] });
      onCleanup(async () => { await browser.close(); await ui.close(); await web.close(); await webClient.close(); });
      const evidence = resolve(process.env.PI_TEST_WEB_EVIDENCE ?? join(tmpdir(), "prk-live-model-evidence"));
      await mkdir(evidence, { recursive: true });
      for (const [device, viewport, colorScheme] of [["desktop", { width: 1440, height: 900 }, "light"], ["phone", { width: 390, height: 844 }, "dark"]]) {
        const name = (await client.request("createSession", { target: "fixture", label: `R2 ${device}` })).session.sessionId;
        const context = await browser.newContext({ viewport, colorScheme, isMobile: device === "phone", hasTouch: device === "phone" });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const click = (locator) => device === "phone" ? locator.tap() : locator.click();
        const shot = (suffix) => page.screenshot({ path: join(evidence, `${device}-${suffix}.png`), fullPage: true, animations: "disabled" });
        await page.goto(ui.url);
        if (device === "phone") await click(page.locator("#open-sidebar"));
        await click(page.locator(`[data-session-id="${name}"]`));
        await until(() => page.locator("#chat-model-select").isEnabled(), "model picker ready");
        const browserPrompt = `R2_BROWSER_${device}`;
        const browserRelease = join(home, `${device}-release`);
        gates.set(browserPrompt, browserRelease);
        await page.locator("#composer").fill(browserPrompt);
        const sent = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `/api/sessions/${name}/send`);
        await click(page.locator("#send-message"));
        const accepted = await (await sent).json();
        assert.equal(accepted.accepted, true);
        try {
          await until(() => host.state(name).kernel?.state === "busy", "browser tool running");
          for (const id of ["chat-model-select", "chat-thinking-select", "chat-tool-mode"]) {
            assert.equal(await page.locator(`#${id}`).isEnabled(), true, `${device}: ${id} remains usable while busy`);
          }
          async function select(id, option, actionName, args) {
            await click(page.locator(`#${id}`));
            await shot(`${actionName}-open-busy`);
            const response = page.waitForResponse((candidate) => candidate.request().method() === "POST" && new URL(candidate.url()).pathname === `/api/sessions/${name}/native` && candidate.request().postDataJSON()?.action === actionName);
            await click(page.locator(option));
            const changed = await response;
            assert.deepEqual(changed.request().postDataJSON().args, args);
            assert.equal((await changed.json()).status, "completed");
            await until(() => page.locator(`#${id}`).isEnabled(), "native refresh completed");
          }
          await select("chat-model-select", '[data-model-option="live-model/alternate"]', "model", { model: "live-model/alternate" });
          await select("chat-thinking-select", '[data-thinking-option="high"]', "thinking", { level: "high" });
          const observed = await page.evaluate(async (worker) => {
            const snapshot = await (await fetch(`/api/sessions/${worker}`)).json();
            const catalog = await (await fetch(`/api/sessions/${worker}/native`)).json();
            return { state: snapshot.state, model: snapshot.model, thinking: snapshot.thinkingLevel, current: catalog.target.current };
          }, name);
          assert.equal(observed.state, "running");
          assert.equal(observed.model, "live-model/alternate");
          assert.equal(observed.thinking, "high");
          assert.equal(observed.current.model, observed.model);
          assert.equal(observed.current.thinkingLevel, observed.thinking);
          await select("chat-tool-mode", '[data-tool-mode="direct"]', "tool-mode", { mode: "direct" });
          // Local tools is a session setting in 会话详情; it stays usable while busy there too.
          await openSessionDetails(page, name, { touch: device === "phone" });
          assert.equal(await page.locator("#chat-local-tools").isEnabled(), true, `${device}: chat-local-tools remains usable while busy`);
          const toggled = page.waitForResponse((response) => response.request().method() === "POST" && response.request().postDataJSON()?.action === "local-tools");
          await click(page.locator("#chat-local-tools"));
          assert.equal((await (await toggled).json()).status, "completed");
          await until(async () => await page.locator("#chat-local-tools").isEnabled() && await page.locator("#chat-local-tools").isChecked(), "local-tools refresh");
          await closeSessionDetails(page, { touch: device === "phone" });
          assert.equal((await current(name)).toolMode, "direct");
          assert.equal((await current(name)).localTools, true);
          await page.mouse.move(0, 0);
          await shot("settings-changed-busy");
          assert.deepEqual(requests.filter((request) => request.prompt === browserPrompt), [{ prompt: browserPrompt, model: "primary", reasoning: "low" }]);
        } finally { await writeFile(browserRelease, "release"); }
        const snapshot = await completed(name, accepted.operationId);
        assert.deepEqual(requests.filter((request) => request.prompt === browserPrompt), [{ prompt: browserPrompt, model: "primary", reasoning: "low" }, { prompt: browserPrompt, model: "alternate", reasoning: "high" }]);
        await page.reload();
        await until(() => page.locator("#chat-model-select").isEnabled(), "page reload restored selection");
        assert.deepEqual((await client.request("state", { sessionId: name })).messages, snapshot.messages);
        assert.deepEqual(errors, [], `${device}: zero pageerror`);
        await context.close();
        console.log(`PASS ${device}: busy model/thinking/tool-mode/local-tools, authoritative refresh, next provider request, reload; screenshots ${evidence}`);
      }
    }
}

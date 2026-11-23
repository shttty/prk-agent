import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function checkBrowserRecovery({ socket, onCleanup, sessionId: worker, workerName, provider, settled, userCount, request, cwd, stopOwner, startOwner, modelRuntime, fauxAssistantMessage }) {
    if (process.argv.includes("--browser")) {
      const { startWebApplication } = await import("../../../src/http/application/start-application.ts");
      const { startWebDev } = await import("../../fixtures/web-dev.mjs");
      const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
      let web = await startWebApplication({ socket, host: "127.0.0.1", port: 0 });
      const port = Number(new URL(web.server.url).port);
      const ui = await startWebDev(web.server.url);
      const browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, args: ["--no-sandbox"] });
      onCleanup(async () => { await browser.close(); await ui.close(); await web.close(); });
      const evidence = process.env.PI_TEST_WEB_EVIDENCE;
      if (evidence) await mkdir(evidence, { recursive: true });
      const viewports = [{ width: 1440, height: 1000 }, { width: 390, height: 844 }];
      const open = async (viewport) => {
        const page = await browser.newPage({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
        await page.goto(ui.url);
        return page;
      };
      const select = async (page, name) => {
        if (await page.locator("#open-sidebar").isVisible()) await page.locator("#open-sidebar").click();
        await page.locator(`[data-session-id="${name}"] .management-session-select`).click();
        await page.locator("#composer").waitFor();
      };
      const menu = async (page, name) => {
        if (await page.locator("#open-sidebar").isVisible()) await page.locator("#open-sidebar").click();
        await page.locator(`[data-session-id="${name}"] [data-action="session-menu"]`).click();
      };
      const closeMenu = async (page) => {
        await page.keyboard.press("Escape");
        if (page.viewportSize().width < 600) await page.keyboard.press("Escape");
      };
      const post = async (page, name, text) => {
        const pending = page.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith(`/api/sessions/${name}/send`));
        await page.locator("#composer").fill(text);
        await page.locator("#send-message").click();
        return pending;
      };
      const invoke = async (page, name, text) => {
        const accepted = await (await post(page, name, text)).json();
        assert.equal(accepted.accepted, true, JSON.stringify(accepted));
        return settled(name, accepted.operationId);
      };
      const shot = async (page, label) => { if (evidence) await page.screenshot({ path: join(evidence, `${label}-${page.viewportSize().width}.png`), fullPage: true }); };
      for (const viewport of viewports) {
        const page = await open(viewport);
        for (const created of [worker]) {
          const name = created.session.sessionId;
          await select(page, name);
          provider.setResponses([fauxAssistantMessage("", { stopReason: "error", errorMessage: "BROWSER_PROVIDER_FAILURE" })]);
          const marker = `BROWSER_FAILED_${created.session.sessionId}_${viewport.width}`;
          assert.equal((await invoke(page, name, marker)).outcome.status, "failed");
          await page.locator('#messages .pi-operation-outcome[data-status="failed"]').waitFor();
          await page.locator('.topbar-status[data-status="idle"]').waitFor();
          assert.equal(await page.locator("#topbar-recover").count(), 0, "a failed operation shows no recovery control");
          await menu(page, name);
          await page.locator("#session-details").waitFor();
          await closeMenu(page);
          await page.waitForFunction(() => { const input = document.querySelector("#composer"); return input && !input.disabled && !input.readOnly; });
          await shot(page, `${created.session.sessionId}-operation-failed`);
          provider.setResponses([fauxAssistantMessage("BROWSER_NEXT_DONE")]);
          const after = await invoke(page, name, `BROWSER_NEXT_${created.session.sessionId}_${viewport.width}`);
          assert.equal(after.outcome.status, "completed");
          assert.equal(userCount(after.state, marker), 1);
          await page.locator('.topbar-status[data-status="idle"]').waitFor();
          console.log(`PASS browser ${created.session.sessionId}/${viewport.width}: failed operation keeps the session idle with no recovery control; next input runs once`);
        }
        // Worker whose environment is gone: unavailable with the reason; sending retries; fixing it lets the message through.
        await request("closeSession", { sessionId: workerName });
        await rm(cwd, { recursive: true, force: true });
        await select(page, workerName);
        await page.locator('.topbar-status[data-status="closed"]').waitFor();
        for (const attempt of [1, 2]) {
          const response = await post(page, workerName, `BROWSER_UNAVAILABLE_${viewport.width}_${attempt}`);
          assert.equal(response.status(), 503);
          const body = await response.json();
          assert.equal(body.details.submitted, false);
          await page.locator('#connection-banner[data-kind="send-rejected"][data-stage="kernel"][data-submitted="false"]').waitFor();
          assert((await page.locator("#connection-banner").textContent()).includes(body.details.reason), "the refusal shows the reason");
          await page.locator('.topbar-status[data-status="unavailable"]').waitFor();
          assert.equal(await page.locator("#composer").inputValue(), `BROWSER_UNAVAILABLE_${viewport.width}_${attempt}`, "the refused draft stays");
        }
        await shot(page, "worker-unavailable");
        await menu(page, workerName);
        await page.locator("#retarget-session").waitFor();
        await closeMenu(page);
        await mkdir(cwd);
        provider.setResponses([fauxAssistantMessage("BROWSER_WORKER_BACK")]);
        assert.equal((await invoke(page, workerName, `BROWSER_FIXED_${viewport.width}`)).outcome.status, "completed");
        await page.locator('.topbar-status[data-status="idle"]').waitFor();
        await page.locator('#connection-banner[data-kind="send-rejected"]').waitFor({ state: "hidden" });
        await shot(page, "worker-back");
        console.log(`PASS browser ${viewport.width}: unavailable worker shows the reason and the refused-send banner; a later message starts it once the environment is fixed`);
        await page.close();
      }
      // A worker with a missing saved model refuses new input without replay, then recovers when it returns.
      await web.close();
      await request("closeSession", { sessionId: workerName });
      await stopOwner();
      modelRuntime.unregisterProvider(provider.provider.id);
      const pages = [];
      try {
        await startOwner();
        web = await startWebApplication({ socket, host: "127.0.0.1", port });
        for (const viewport of viewports) {
          const page = await open(viewport);
          pages.push(page);
          await select(page, workerName);
          const response = await post(page, workerName, `BROWSER_MODEL_REFUSED_${viewport.width}`);
          assert.equal(response.status(), 503);
          await page.locator('#connection-banner[data-kind="send-rejected"][data-stage="kernel"][data-submitted="false"]').waitFor();
          await page.locator('.topbar-status[data-status="unavailable"]').waitFor();
          await page.locator("#recovery-controls").waitFor();
          assert.match(await page.locator("#recovery-status").textContent(), /model .* unavailable/);
          assert.equal(await page.locator("#topbar-recover").count(), 1);
          await shot(page, "model-refused");
        }
      } finally {
        modelRuntime.registerNativeProvider(provider.provider);
        await modelRuntime.refresh({ allowNetwork: false });
      }
      for (const page of pages) {
        provider.setResponses([fauxAssistantMessage("BROWSER_MODEL_BACK")]);
        const marker = `BROWSER_MODEL_BACK_${page.viewportSize().width}`;
        const back = await invoke(page, workerName, marker);
        assert.equal(back.outcome.status, "completed");
        assert.equal(userCount(back.state, marker), 1);
        await page.locator('.topbar-status[data-status="idle"]').waitFor();
        await page.locator("#recovery-controls").waitFor({ state: "hidden" });
        await shot(page, "model-back");
        console.log(`PASS browser worker/${page.viewportSize().width}: missing model refuses input with a reason; restored model resumes new input`);
        await page.close();
      }
    }
}

import assert from "node:assert/strict";
import { closeSessionDetails, openSessionDetails } from "../../fixtures/session-details.mjs";

export function createToolControls({ page, client, host, click, until, phone }) {
        const modeOption = (mode) => page.locator(`[role="option"]:has([data-tool-mode=${JSON.stringify(mode)}]):visible`);
        async function selectedMode(worker, expected) {
          const catalog = await client.call("nativeCapabilities", { sessionId: worker.sessionId });
          assert.equal(catalog.target.current.toolMode, expected);
          assert.equal(catalog.target.local, worker.target !== "remote");
          await until(async () => await page.locator("#chat-tool-mode").isEnabled(), "tool-mode refresh completes");
          await click(page.locator("#chat-tool-mode"));
          assert.deepEqual(await page.locator("[data-tool-mode]").evaluateAll((nodes) => nodes.map((node) => node.dataset.toolMode)), ["code", "direct"]);
          assert.equal(await modeOption(expected).getAttribute("aria-selected"), "true", "Composer displays authoritative mode");
          await page.locator("#chat-tool-mode").press("Escape");
        }
        async function changeMode(worker, mode) {
          const previous = (await client.call("nativeCapabilities", { sessionId: worker.sessionId })).target.current;
          if (previous.toolMode === mode) { await selectedMode(worker, mode); return; }
          const before = await page.locator("[data-message-id]").count();
          await until(async () => await page.locator("#chat-tool-mode").isEnabled(), "tool-mode can change");
          await click(page.locator("#chat-tool-mode"));
          const response = page.waitForResponse((candidate) => candidate.request().method() === "POST"
            && new URL(candidate.url()).pathname === `/api/sessions/${worker.sessionId}/native`
            && candidate.request().postDataJSON()?.action === "tool-mode");
          await click(page.locator(`[data-tool-mode=${JSON.stringify(mode)}]`));
          const changed = await response;
          assert.deepEqual(changed.request().postDataJSON().args, { mode });
          assert.equal(changed.ok(), true);
          assert.equal((await changed.json()).status, "completed");
          await selectedMode(worker, mode);
          assert.equal((await client.call("nativeCapabilities", { sessionId: worker.sessionId })).target.current.localTools, previous.localTools, "Mode changes preserve local-tools selection");
          assert.equal(await page.locator("[data-message-id]").count(), before, "Mode changes do not append transcript cards");
        }
        async function changeLocalTools(worker, enabled) {
          const previousMode = (await client.call("nativeCapabilities", { sessionId: worker.sessionId })).target.current.toolMode;
          // The switch is a session setting in 会话详情.
          await openSessionDetails(page, worker.sessionId, { touch: phone });
          const control = page.locator("#chat-local-tools");
          await until(() => control.isEnabled(), "local-tools refresh completes");
          if (await control.isChecked() !== enabled) {
            const before = await page.locator(".pi-native-interaction-card").count();
            const response = page.waitForResponse((candidate) => candidate.request().method() === "POST"
              && new URL(candidate.url()).pathname === `/api/sessions/${worker.sessionId}/native`
              && candidate.request().postDataJSON()?.action === "local-tools");
            await click(control);
            const changed = await response;
            assert.deepEqual(changed.request().postDataJSON().args, { enabled });
            assert.equal((await changed.json()).status, "completed");
            await until(async () => await control.isEnabled() && await control.isChecked() === enabled, "switch reflects refreshed catalog");
            assert.equal(await page.locator(".pi-native-interaction-card").count(), before, "Switch does not append native-action transcript cards while SDK messages stream");
          }
          await closeSessionDetails(page, { touch: phone });
          assert.equal((await client.call("nativeCapabilities", { sessionId: worker.sessionId })).target.current.localTools, enabled);
          assert.equal((await client.call("nativeCapabilities", { sessionId: worker.sessionId })).target.current.toolMode, previousMode, "Local-tools changes preserve tool mode");
        }
        async function reloadTools(worker) {
          assert.equal(host.state(worker.sessionId).requiresReload, true);
          const button = page.locator("#reload-capabilities");
          await until(() => button.isEnabled(), "idle native reload becomes available");
          const response = page.waitForResponse((candidate) => candidate.request().method() === "POST"
            && new URL(candidate.url()).pathname === `/api/sessions/${worker.sessionId}/native`
            && candidate.request().postDataJSON()?.action === "reload");
          await click(button);
          assert.equal((await (await response).json()).status, "completed");
          await page.locator('[data-requires-reload="true"]').waitFor({ state: "hidden" });
          assert.equal(host.state(worker.sessionId).requiresReload, false);
        }
  return { selectedMode, changeMode, changeLocalTools, reloadTools };
}

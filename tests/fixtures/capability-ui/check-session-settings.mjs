import { parse } from "smol-toml";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fauxAssistantMessage, fauxToolCall, getCurrentTools } from "@earendil-works/pi-ai";
import { MASK } from "../../../src/sessions/plugin-config/config-constants.ts";
import { checkCopyPeekBoundary } from "./check-copy-peek-boundary.mjs";

export async function checkSessionSettings({ browser, ui, host, provider, home, pluginFile, rawFile, evidence, live, settled, showProvider }) {
    const worker = (await host.createSession({ target: "fixture", label: "Capability fixture" })).session.sessionId;
    const mode = await host.nativeAction(worker, { sessionId: worker, requestId: crypto.randomUUID(), action: "tool-mode", args: { mode: "direct" } });
    assert.equal(mode.status, "completed");
    const initialState = host.state(worker);
    const groupId = "group:tools:package:prk-panel-fixture";
    for (const [tag, width, height, colorScheme] of [["desktop-light", 1440, 960, "light"], ["desktop-dark", 1440, 960, "dark"], ["phone-light", 390, 844, "light"], ["phone-dark", 390, 844, "dark"]]) {
      const context = await browser.newContext({ viewport: { width, height }, colorScheme, isMobile: width < 600, hasTouch: width < 600 });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.setDefaultTimeout(15000);
      await page.goto(ui.url);
      const phone = width < 600;
      const sidebar = async () => { if (phone) await page.locator("#open-sidebar").click(); };
      await sidebar();
      await page.locator(`[data-session-id="${worker}"] .management-session-select`).click();
      await page.locator("#composer").waitFor();
      // Phone: a provider opens in a sheet over the page; desktop: in the right block.
      const scope = phone ? "#capability-sheet" : live;
      const closeSheet = async () => { if (phone && await page.locator('.capability-layer[data-open="true"]').count()) await page.locator('#capability-sheet [data-action="close-provider"]').click(); };
      const openSettings = async (section) => {
        await sidebar(); await page.locator("#open-settings").click();
        await page.locator(`[data-settings-section="${section}"]`).click({ position: { x: 20, y: 20 } });
        await page.locator(`.capabilities-panel[data-kind="${section}"][aria-busy="false"]`).waitFor(); await settled(page);
      };
      const closeSettings = async () => { await closeSheet(); await page.locator("#close-settings").click(); };
      const closeSession = async () => { await closeSheet(); await page.locator("#close-session-capabilities").click(); };
      const menu = async (id) => { await sidebar(); await page.locator(`[data-session-id="${worker}"] [data-action="session-menu"]`).click(); await page.locator(`#${id}`).click(); };
      const filter = () => showProvider(page, groupId, scope);
      const row = () => page.locator(`${scope} [data-capability="tool:panel_probe"]`);
      const stop = (value) => row().locator(`[data-stop="${value}"]`);
      const isOn = async () => (await row().locator(".capability-mode").getAttribute("data-mode")) !== "off";
      const loaded = () => page.locator('.capabilities-panel[data-kind="tools"][aria-busy="false"]').waitFor();
      const groupStop = (value) => page.locator(`${scope} [data-capability-group="${groupId}"] [data-stop="${value}"]`);
      const nextRequest = async (enabled) => {
        assert.equal(await page.locator('[data-requires-reload="true"]').count(), 0, "switches show no reload banner");
        assert.equal(host.state(worker).requiresReload, false, "switches require no resource reload");
        const requests = [];
        const capture = (context) => requests.push(getCurrentTools(context.messages).map(({ name }) => name));
        const call = fauxToolCall("panel_probe", {});
        provider.setResponses([
          (context) => { capture(context); return fauxAssistantMessage(call, { stopReason: "toolUse" }); },
          (context) => { capture(context); return fauxAssistantMessage("Observed capability switch."); },
        ]);
        const operation = await host.session(worker).submit({ requestId: crypto.randomUUID(), message: "Exercise the changed capability without reload." });
        assert.equal(operation.accepted, true);
        assert.equal((await operation.completion).status, "completed");
        assert.equal(requests.length, 2, "the real provider observes the call and its result");
        for (const tools of requests) assert.equal(tools.includes("panel_probe"), enabled, "the next provider declaration follows the switch");
        const result = host.state(worker).messages.findLast((message) => message.role === "toolResult" && message.toolCallId === call.id);
        assert(result, "the real SDK records the attempted tool call");
        assert.equal(result.isError, !enabled, JSON.stringify(result));
        const text = result.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
        if (enabled) assert.equal(text, "fixture", "the enabled plugin executes without reload");
        else assert(text.includes("panel_probe"), "permission denial identifies the disabled tool");
        assert.equal(host.state(worker).streamId, initialState.streamId, "switches preserve the SDK runtime");
        assert.equal(host.state(worker).requiresReload, false);
        assert.equal(await page.locator('[data-requires-reload="true"]').count(), 0);
      };
      await openSettings("tools");
      await filter();
      await stop("off").click(); await loaded();
      await page.locator(`${scope} [data-capability-group="${groupId}"][data-state="mixed"]`).waitFor();
      assert.equal((structuredClone(parse(await readFile(join(home, "config.toml"), "utf8")))).session.capabilities["tool:panel_probe"], false);
      await groupStop("off").click(); await loaded();
      assert.equal(await stop("on").isDisabled(), true);
      await groupStop("on").click(); await loaded();
      assert.equal(await isOn(), false, "group enable restores individual settings");
      if (evidence && tag === "desktop-light") await page.screenshot({ path: join(evidence, "settings-desktop-light.png"), animations: "disabled" });
      await closeSettings();
      await nextRequest(false);
      await menu("session-tools"); await loaded(); await filter();
      await stop("on").click(); await loaded();
      await nextRequest(true);
      await stop("off").click(); await loaded();
      await nextRequest(false);
      await row().locator('[data-overridden="true"]').waitFor();
      if (tag.endsWith("light")) await checkCopyPeekBoundary({ page, row: row(), phone });
      if (!phone) { await page.mouse.move(1, 1); await row().locator(".capability-name").hover(); await page.locator('#capability-peek[data-open="true"]').waitFor(); }
      if (evidence) await page.screenshot({ path: join(evidence, `${tag}.png`), animations: "disabled" });
      if (tag === "desktop-light") {
        await closeSession();
        await openSettings("tools"); await filter();
        assert.equal(await isOn(), false, "a live session cannot remove the globally disabled tool from the directory");
        await page.locator('[data-action="refresh-capabilities"]').click(); await loaded();
        assert.equal(await isOn(), false, "all-on directory refresh retains tools excluded by defaults");
        await closeSettings();
        await menu("session-tools"); await loaded(); await filter();
        assert.equal(await isOn(), false, "disabled session tools remain visible and off without reload");
        assert.equal(await page.locator('[data-action="refresh-capabilities"]').count(), 0, "session panels have no global refresh action");
        await stop("on").click(); await loaded();
        await closeSession();
        await nextRequest(true);
        await menu("session-tools"); await loaded(); await filter();
        assert.equal(await isOn(), true, "a disabled tool can be enabled immediately");
        assert.equal(host.state(worker).requiresReload, false);
      }
      await row().locator('[data-action="restore-default"]').click(); await loaded();
      assert.equal(await row().locator('[data-overridden="true"]').count(), 0);
      assert.equal(await isOn(), false, "restoring uses the current global default");
      await closeSession();
      await nextRequest(false);
      assert.equal(host.state(worker).requiresReload, false);
      assert.equal(host.state(worker).kernel.state, "not_started", "capability switches do not allocate a kernel");
      await openSettings("tools"); await filter(); await stop("on").click(); await loaded();
      if (tag === "desktop-light") {
        await showProvider(page, "group:tools:package:<inline:terminals>");
        await page.locator(`${live} [data-action="open-config"][data-provider="group:tools:package:<inline:terminals>"]`).click();
        await page.locator('#plugin-config[aria-hidden="false"] [data-config-field="yieldMs"] input').fill("12");
        await page.locator('#config-pending[data-count="1"] [data-action="config-write"]').click(); await loaded();
        await page.locator("#config-pending").waitFor({ state: "detached" });
        assert.equal((await host.capabilitiesList()).terminal.yieldMs, 12000);
        await page.locator('#plugin-config [data-action="close-config"]').click();
        // The three config cases: semantics → form; nothing → add a path → JSON fields; pending bar writes / resets.
        const panel = page.locator('#plugin-config[aria-hidden="false"]');
        const openConfig = async (provider) => {
          await showProvider(page, provider);
          await page.locator(`${live} [data-action="open-config"][data-provider="${provider}"]`).click();
          await panel.locator(`.config-body`).waitFor();
        };
        await openConfig(groupId);
        await panel.locator('[data-config-mode="semantic"]').waitFor();
        assert.equal(await panel.locator('[data-config-field="token"] input').inputValue(), MASK, "secret masked in the form");
        await panel.locator('[data-config-field="limit"] input').fill("7");
        assert.equal(await page.locator('#config-pending [data-pending-key="limit"]').count(), 1);
        await page.locator('#config-pending [data-action="config-write"]').click();
        await panel.locator('#config-written[data-status="written"]').waitFor();
        assert.deepEqual(JSON.parse(await readFile(pluginFile, "utf8")), { limit: 7, token: "tok_plain", extra: { keep: true } }, "write changes only the edited key");
        await page.locator('#plugin-config [data-action="close-config"]').click();
        await openConfig("group:tools:kernel");
        await panel.locator('[data-config-mode="none"] [data-action="add-config-path"]').click();
        await panel.locator("#config-path-input").fill(rawFile);
        await panel.locator('[data-action="save-config-path"]').click();
        await panel.locator('[data-config-mode="raw"]').waitFor();
        await panel.locator('[data-config-field="nested.on"] input').click({ force: true });
        await page.locator('#config-pending[data-count="1"]').waitFor();
        await page.locator('#config-pending [data-action="config-reset"]').click();
        await page.locator("#config-pending").waitFor({ state: "detached" });
        assert.deepEqual(JSON.parse(await readFile(rawFile, "utf8")), { depth: 2, nested: { on: false } }, "reset writes nothing");
        await page.locator('#plugin-config [data-action="close-config"]').click();
      }
      await closeSettings(); await nextRequest(true);
      await openSettings("skills");
      await showProvider(page, "group:skills:shared", scope);
      await page.locator("#skills-entry-panel-skill .capability-copy").click();
      assert.equal(await page.locator("#skill-evidence").textContent(), "Observed isolated panel workflow.");
      await closeSettings();
      assert.deepEqual(errors, [], `${tag}: zero pageerror`);
      await context.close();
      console.log(`PASS capability UI ${tag}: source filters, group memory/mixed state, override/reset, next-request declarations and permissions without reload, shared skill details; pageerrors=0`);
    }
}

// Real Chromium + Vite, mocked API: a plugin tool reached through direct mode's `tool_call` uses the plugin's own
// rendering, published in extensionUiRender.tools / toolErrors under the NESTED call's id (`<outer>/1`), exactly like a
// directly called plugin row under its own id; without a rendering the row falls back to the generic body, and
// toolsExpanded opens these rows like direct ones.
import assert from "node:assert/strict";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";
import { selectSession } from "../fixtures/workspace-mock/select-session.mjs";

const now = Date.now();
const text = (...lines) => ({ kind: "text", lines });
const call = (id, name, args, out, at) => [
  { role: "assistant", stopReason: "toolUse", timestamp: now - at, content: [{ type: "toolCall", id, name, arguments: args }] },
  { role: "toolResult", toolCallId: id, toolName: name, content: [{ type: "text", text: out }], isError: false, timestamp: now - at + 500,
    ...(name === "tool_call" ? { nestedCalls: { complete: true, calls: [{ id: `${id}/1`, name: args.name, status: "ok", arguments: args.args }] } } : {}) },
];
const messages = [
  { role: "user", content: [{ type: "text", text: "go" }], timestamp: now - 60_000 },
  ...call("d1", "todo_list", { action: "write" }, "Write 2 items", 50_000),
  ...call("n1", "tool_call", { name: "todo_list", args: { action: "read" } }, "Read 2 items", 40_000),
  ...call("n2", "tool_call", { name: "probe_plain", args: { q: 1 } }, "plain out", 30_000),
  ...call("n3", "tool_call", { name: "probe_broken", args: { q: 2 } }, "broken out", 20_000),
  { role: "assistant", stopReason: "stop", timestamp: now - 10_000, content: [{ type: "text", text: "done" }] },
];
const extensionUi = { revision: 1, autocomplete: false, status: [], notifications: [], working: { visible: false }, editor: { text: "", revision: 0 }, widgets: [] };
const render = (toolsExpanded) => ({ streamId: "mock-s1", revision: 2, status: [], notifications: [], widgets: [], prompts: [], messages: {}, entries: [], rendererErrors: [], toolsExpanded,
  tools: {
    d1: { shell: "default", call: text("todo_list write"), result: text("direct plugin result") },
    "n1/1": { shell: "default", call: text("todo_list read"), result: text("nested plugin result") },
  },
  // A renderer error under the outer id must not reach the nested row; its own id must.
  toolErrors: { n3: { call: "outer id is not the key" }, "n3/1": { result: "renderer failed" } } });
const snapshot = { streamId: "mock-s1", sessionId: "w1", sequence: 5, state: "idle", messages, queuedMessages: { steering: [], followUp: [] }, model: "clp/gpt-6", thinkingLevel: "medium", recentOperations: [], messageEntryIds: messages.map((_, index) => `e${index}`), extensionUi };
const sessions = [{ label: "direct", sessionId: "w1", state: "idle", target: "alpha", cwd: "/data" }];
const catalog = { version: 1, target: { identity: "w1", streamId: "mock-s1", sessionId: "w1", state: "idle", readOnly: false, local: false, target: "alpha", current: { toolMode: "direct" } }, commands: [], actions: [], inputPrefixes: [], resources: [], attachments: { enabled: true, imageMimeTypes: [] }, references: { targetFile: { enabled: true, candidates: [] } } };

const server = await startWebDev("http://127.0.0.1:9");
const browser = await loadChromium();
try {
  for (const toolsExpanded of [false, true]) {
    const h = await openMockWorkbench(browser, server.url, { sessions, snapshots: { w1: snapshot }, routes: {
      "/api/sessions/w1/native": (body) => (!body.action ? catalog : { requestId: body.requestId, action: body.action, status: "completed", message: "ok",
        data: body.action === "extension-ui" && body.args?.operation === "render" ? render(toolsExpanded) : { streamId: "mock-s1", status: "completed", extensionUi } }),
    } });
    const { page } = h;
    const row = (id) => page.locator(`.pi-tool[data-tool-key$=":${id}"]`);
    try {
      await selectSession(page, "w1");
      // The turn fold follows extensionUiRender.toolsExpanded once the render reply lands (TurnProcess), so settle the
      // render first; touching folds before that races the product opening them.
      await row("n1").and(page.locator('[data-extension-shell="default"]')).waitFor({ state: "attached" });
      for (const fold of await page.locator("details.pi-turn-process:not([open]) > summary").all()) await fold.click();
      assert.equal(await page.locator("details.pi-turn-process:not([open])").count(), 0, "every turn fold is open");
      assert.deepEqual(await page.locator(".pi-tool").evaluateAll((nodes) => nodes.map((node) => [node.dataset.toolName, node.dataset.via ?? null, node.dataset.extensionShell ?? null])),
        [["todo_list", null, "default"], ["todo_list", "tool_call", "default"], ["probe_plain", "tool_call", null], ["probe_broken", "tool_call", null]],
        "the nested plugin row takes its renderer like the direct one; others fall back");
      // toolsExpanded opens direct and nested rows alike.
      const open = await page.locator(".pi-tool").evaluateAll((nodes) => nodes.map((node) => node.open));
      assert.deepEqual(open, [toolsExpanded, toolsExpanded, toolsExpanded, toolsExpanded], `toolsExpanded=${toolsExpanded} applies to every row`);
      if (!toolsExpanded) for (const id of ["d1", "n1", "n2"]) await row(id).locator(":scope > summary").click();
      assert.equal(await row("n1").locator(".pi-tool-call .extension-ui-text").first().textContent(), "todo_list read", "the plugin's renderCall is the header");
      await row("n1").locator(".extension-tool-result").waitFor();
      assert.equal(await row("n1").locator(".pi-io").count(), 0, "no generic body under a plugin rendering");
      await row("n2").locator('.pi-io[data-kind="generic"]').waitFor();
      assert.equal(await row("n2").locator(".extension-tool-result, .pi-tool-call").count(), 0, "missing rendering: generic body");
      assert.deepEqual(await row("n3").locator("[data-extension-renderer-error]").evaluateAll((nodes) => nodes.map((node) => node.dataset.extensionRendererError)), ["n3/1"],
        "renderer errors also come from the nested id");
      if (!toolsExpanded) {
        await page.evaluate(() => {
          const source = window.__eventSources.find((item) => /sessions\/w1\/events/.test(item.url));
          const emit = (sequence, type, details, extra = {}) => source.dispatchEvent(new MessageEvent("host", {
            data: JSON.stringify({ type, streamId: "mock-s1", sessionId: "w1", sequence, operationId: "op-live", timestamp: new Date().toISOString(), details, ...extra }),
          }));
          emit(10, "state_changed", { state: "running", operation: { operationId: "op-live", startedAt: new Date().toISOString() } });
          emit(11, "session_event", { sdkType: "message_end", message: { role: "user", content: [{ type: "text", text: "LIVE_USER_BEFORE_MODEL" }], timestamp: Date.now() } });
        });
        await page.locator(".pi-message-user").filter({ hasText: "LIVE_USER_BEFORE_MODEL" }).waitFor({ state: "visible" });
        await page.evaluate(() => {
          const source = window.__eventSources.find((item) => /sessions\/w1\/events/.test(item.url));
          const emit = (sequence, type, details, extra = {}) => source.dispatchEvent(new MessageEvent("host", {
            data: JSON.stringify({ type, streamId: "mock-s1", sessionId: "w1", sequence, operationId: "op-live", timestamp: new Date().toISOString(), details, ...extra }),
          }));
          emit(12, "session_event", { sdkType: "message_end", message: { role: "assistant", stopReason: "toolUse", timestamp: Date.now(), content: [{ type: "toolCall", id: "live-t1", name: "bash", arguments: { command: "ls" } }] } });
          emit(13, "session_event", { sdkType: "tool_execution_start", toolCallId: "live-t1", toolName: "bash", args: { command: "ls" } });
          emit(14, "session_event", { sdkType: "tool_execution_end", toolCallId: "live-t1", toolName: "bash", result: { content: [{ type: "text", text: "ok" }] }, isError: false });
          emit(15, "session_event", { sdkType: "message_end", message: { role: "toolResult", toolCallId: "live-t1", toolName: "bash", content: [{ type: "text", text: "ok" }], isError: false, timestamp: Date.now() } });
          emit(16, "message", {}, { text: "LIVE_STREAMING_ANSWER" });
          emit(17, "extension_ui", { extensionUi: { revision: 3, autocomplete: false, status: [], notifications: [], working: { visible: false }, editor: { text: "", revision: 0 }, widgets: [] } });
        });
        await page.locator(".pi-message-assistant").filter({ hasText: "LIVE_STREAMING_ANSWER" }).waitFor({ state: "visible" });
        await page.waitForTimeout(150);
        const liveFold = page.locator('details.pi-turn-process[data-state="running"]');
        assert.equal(await liveFold.count(), 1, "live multi-step turn stays in running state while generating");
        assert.equal(await liveFold.evaluate((node) => node.open), true, "default toolsExpanded=false render reply must not collapse a running turn fold");
      }
      assert.deepEqual(h.problems, [], "no page errors");
    } finally { await h.context.close(); }
  }
  console.log("PASS tool_call plugin rows: renderer and errors by the nested call id, generic fallback, toolsExpanded like direct rows");
} finally {
  await browser.close();
  await server.close();
}

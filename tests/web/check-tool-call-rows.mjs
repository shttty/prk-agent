// Real Chromium + Vite, mocked API: in direct mode a hidden tool runs through the `tool_call` meta tool. Its row is
// the real tool (name, arguments, body kind, result, status), tagged data-via="tool_call"; the meta call has no row of
// its own, live or after a refresh; tool_search keeps its ordinary row. Nested SDK events add no rows.
import assert from "node:assert/strict";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";
import { selectSession } from "../fixtures/workspace-mock/select-session.mjs";

const now = Date.now();
const read = { name: "read", args: { path: "src/app.ts", offset: 1, limit: 3 } };
const messages = [
  { role: "user", content: [{ type: "text", text: "go" }], timestamp: now - 60_000 },
  { role: "assistant", stopReason: "toolUse", timestamp: now - 50_000, content: [{ type: "toolCall", id: "q1", name: "tool_search", arguments: { query: "read file" } }] },
  { role: "toolResult", toolCallId: "q1", toolName: "tool_search", content: [{ type: "text", text: "read: Read a file" }], isError: false, timestamp: now - 49_000 },
  { role: "assistant", stopReason: "toolUse", timestamp: now - 48_000, content: [{ type: "toolCall", id: "c1", name: "tool_call", arguments: read }] },
  { role: "toolResult", toolCallId: "c1", toolName: "tool_call", content: [{ type: "text", text: "line one\nline two\nline three" }], isError: false, timestamp: now - 47_000,
    nestedCalls: { complete: true, calls: [{ id: "c1/1", name: "read", status: "ok", arguments: read.args }] } },
  { role: "assistant", stopReason: "toolUse", timestamp: now - 46_000, content: [{ type: "toolCall", id: "c2", name: "tool_call", arguments: { name: "probe_fail", args: { n: 1 } } }] },
  { role: "toolResult", toolCallId: "c2", toolName: "tool_call", content: [{ type: "text", text: "probe failed" }], isError: true, timestamp: now - 45_000,
    nestedCalls: { complete: true, calls: [{ id: "c2/1", name: "probe_fail", status: "error", arguments: { n: 1 } }] } },
  { role: "assistant", stopReason: "stop", timestamp: now - 44_000, content: [{ type: "text", text: "done" }] },
];
const snapshot = { streamId: "mock-s1", sessionId: "w1", sequence: 5, state: "running", messages, queuedMessages: { steering: [], followUp: [] }, model: "clp/gpt-6", thinkingLevel: "medium", recentOperations: [], messageEntryIds: messages.map((_, index) => `e${index}`) };
const sessions = [{ label: "direct", sessionId: "w1", state: "running", target: "alpha", cwd: "/data" }];

const server = await startWebDev("http://127.0.0.1:9");
const browser = await loadChromium();
try {
  const h = await openMockWorkbench(browser, server.url, { sessions, snapshots: { w1: snapshot } });
  const { page } = h;
  const row = (id) => page.locator(`.pi-tool[data-tool-key$=":${id}"]`);
  const openAll = async () => {
    for (const fold of await page.locator("details.pi-turn-process:not([open]) > summary").all()) await fold.click();
  };
  try {
    await selectSession(page, "w1");
    await row("c1").waitFor({ state: "attached" });
    await openAll();
    assert.equal(await page.locator('.pi-tool[data-tool-name="tool_call"]').count(), 0, "the meta call never has a row of its own");
    assert.equal(await row("q1").getAttribute("data-tool-name"), "tool_search", "tool_search keeps its row");
    assert.equal(await row("q1").getAttribute("data-via"), null);
    assert.equal(await row("c1").getAttribute("data-tool-name"), "read");
    assert.equal(await row("c1").getAttribute("data-via"), "tool_call");
    assert.equal(await row("c1").getAttribute("data-state"), "done");
    assert.equal(await row("c1").locator('summary .pi-tool-via[data-via="tool_call"]').count(), 1, "the meta call is a tag on the real row");
    assert.equal(await row("c2").getAttribute("data-tool-name"), "probe_fail");
    assert.equal(await row("c2").getAttribute("data-state"), "error", "the hidden tool's failure is the row's state");
    await row("c1").locator(":scope > summary").click();
    await row("c1").locator('.pi-io[data-kind="read"]').waitFor();
    assert.equal(await row("c1").locator(".pi-nested-call").count(), 0, "the hidden call is the row itself, not a nested call");

    // Live: the outer tool_call starts, the SDK forwards the nested execution with parentToolCallId.
    const events = [
      { sdkType: "tool_execution_start", toolCallId: "c3", toolName: "tool_call", args: { name: "probe_live", args: { q: "x" } } },
      { sdkType: "tool_execution_start", toolCallId: "c3/1", toolName: "probe_live", args: { q: "x" }, parentToolCallId: "c3" },
      { sdkType: "tool_execution_update", toolCallId: "c3", toolName: "tool_call", args: { name: "probe_live", args: { q: "x" } }, partialResult: { content: [{ type: "text", text: "partial" }] } },
    ];
    await page.evaluate((details) => {
      const source = window.__eventSources.find((item) => /sessions\/w1\/events/.test(item.url));
      details.forEach((entry, index) => source.dispatchEvent(new MessageEvent("host", { data: JSON.stringify({ type: "session_event", streamId: "mock-s1", sessionId: "w1", sequence: 10 + index, operationId: "op-live", timestamp: new Date().toISOString(), details: entry }) })));
    }, events);
    await row("c3").waitFor({ state: "attached" });
    assert.equal(await row("c3").getAttribute("data-tool-name"), "probe_live", "the running row is already the real tool");
    assert.equal(await row("c3").getAttribute("data-via"), "tool_call");
    assert.equal(await row("c3").getAttribute("data-state"), "running");
    assert.equal(await page.locator('.pi-tool[data-tool-key$=":c3/1"]').count(), 0, "nested events add no row");
    assert.equal(await page.locator('.pi-tool[data-tool-name="tool_call"]').count(), 0);

    // Refresh: history alone gives the same rows.
    await page.reload();
    await selectSession(page, "w1");
    await row("c1").waitFor({ state: "attached" });
    await openAll();
    assert.deepEqual(await page.locator(".pi-tool").evaluateAll((nodes) => nodes.map((node) => [node.dataset.toolName, node.dataset.via ?? null])),
      [["tool_search", null], ["read", "tool_call"], ["probe_fail", "tool_call"]]);
    assert.deepEqual(h.problems, [], "no page errors");
    console.log("PASS tool_call rows: hidden tool shown as itself (live and history), meta call folded into a tag, tool_search unchanged");
  } finally { await h.context.close(); }
} finally {
  await browser.close();
  await server.close();
}

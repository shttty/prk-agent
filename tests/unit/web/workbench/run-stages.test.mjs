import assert from "node:assert/strict";
import test from "node:test";
import { createWorkbenchStore } from "../../../../web/workbench/store/assemble-workbench-store.js";
import { currentRunStage } from "../../../../web/chat/composer/run-stage/current-run-stage.js";

test("the operation bar stage (data-stage) follows send admission and the live host events", async () => {
  const sources = [];
  const previous = { EventSource: globalThis.EventSource, fetch: globalThis.fetch };
  globalThis.EventSource = class extends EventTarget {
    constructor(url) {
      super();
      this.url = url;
      this.readyState = 1;
      sources.push(this);
      queueMicrotask(() => {
        this.dispatchEvent(new Event("open"));
        if (url.endsWith("/sessions/events")) this.emit("snapshot", { targets: [], sessions: [{ sessionId: "w1", state: "idle", target: "t" }] });
      });
    }
    close() { this.readyState = 2; }
    emit(type, value) { this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(value) })); }
  };
  const initial = { streamId: "host-1", sessionId: "w1", sequence: 1, state: "idle", messages: [], messageEntryIds: [], recentOperations: [] };
  let admit;
  globalThis.fetch = async (path, init) => {
    if (String(path).endsWith("/send") && init?.method === "POST") {
      await new Promise((resolve) => { admit = resolve; });
      return { ok: true, status: 200, text: async () => JSON.stringify({ accepted: true, operationId: "op-1" }) };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify(String(path).endsWith("/sessions/w1") ? initial : {}) };
  };
  const store = createWorkbenchStore();
  try {
    store.start();
    await new Promise((done) => setTimeout(done, 0));
    await store.actions.selectSession("w1");
    const events = sources.find((source) => source.url.endsWith("/sessions/w1/events"));
    events.emit("snapshot", initial);
    let sequence = initial.sequence;
    const host = (type, details = {}, extra = {}) => events.emit("host", { streamId: "host-1", sequence: ++sequence, sessionId: "w1", type, operationId: "op-1", timestamp: "2026-11-19T07:30:00.000Z", details, ...extra });
    const stage = () => currentRunStage(store.getSnapshot())?.stage ?? null;

    assert.equal(stage(), null, "idle");
    const sent = store.actions.sendMessage("hello");
    await new Promise((done) => setTimeout(done, 0));
    assert.equal(stage(), "sending", "until the Gateway admits the request");
    admit();
    assert.equal(await sent, true);
    host("request_accepted", {}, { requestId: "r1" });
    host("state_changed", { state: "running", operation: { operationId: "op-1", startedAt: "2026-11-19T07:30:00.000Z" } });
    assert.equal(stage(), "waiting", "admitted, no stream event yet");
    host("operation_started");
    assert.equal(stage(), "waiting");
    host("message", { part: "thinking", contentIndex: 0 }, { text: "**Plan**\n\nnext" });
    assert.equal(stage(), "thinking");
    assert.equal(currentRunStage(store.getSnapshot()).text, "思考中…", "the composer does not repeat the transcript thinking preview");
    host("message", {}, { text: "Checking." });
    assert.equal(stage(), "output");
    host("session_event", { sdkType: "message_end", message: { role: "assistant", stopReason: "toolUse", content: [{ type: "toolCall", id: "c1", name: "bash", arguments: {} }] } });
    host("session_event", { sdkType: "tool_execution_start", toolCallId: "c1", toolName: "bash", args: {} });
    assert.equal(stage(), "tool");
    host("session_event", { sdkType: "tool_execution_start", toolCallId: "c1/1", toolName: "read", args: {}, parentToolCallId: "c1" });
    host("session_event", { sdkType: "tool_execution_end", toolCallId: "c1/1", toolName: "read", result: {}, parentToolCallId: "c1" });
    assert.equal(stage(), "tool", "nested calls stay inside the outer tool's stage");
    host("session_event", { sdkType: "tool_execution_end", toolCallId: "c1", toolName: "bash", result: { content: [] }, isError: false });
    assert.equal(stage(), "waiting", "tool result back, next model call not streaming yet");
    host("session_event", { sdkType: "auto_retry_start", attempt: 1, maxAttempts: 3 });
    assert.equal(stage(), "retry");
    host("session_event", { sdkType: "message_update", assistantEvent: "toolcall_delta" });
    assert.equal(stage(), "output", "streamed tool-call arguments are model output");
    host("operation_completed", { operationId: "op-1", status: "completed" });
    host("state_changed", { state: "idle", operation: null });
    assert.equal(stage(), null, "idle again");
  } finally {
    store.dispose();
    globalThis.EventSource = previous.EventSource;
    globalThis.fetch = previous.fetch;
  }
});

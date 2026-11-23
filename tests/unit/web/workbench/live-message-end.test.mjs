import assert from "node:assert/strict";
import test from "node:test";
import { createWorkbenchStore } from "../../../../web/workbench/store/assemble-workbench-store.js";
import { projectConversation } from "../../../../web/chat/conversation/project-conversation.js";

function createLiveHarness() {
  const sources = [];
  const anchoredPage = Promise.withResolvers();
  const previousEventSource = globalThis.EventSource;
  const previousFetch = globalThis.fetch;
  globalThis.EventSource = class extends EventTarget {
    constructor(url) {
      super();
      this.url = url;
      this.readyState = 1;
      sources.push(this);
      queueMicrotask(() => {
        this.dispatchEvent(new Event("open"));
        if (url.endsWith("/sessions/events")) {
          this.emit("snapshot", { targets: [], sessions: [{ sessionId: "w1", state: "idle", target: "t" }] });
        }
      });
    }
    close() { this.readyState = 2; }
    emit(type, value) { this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(value) })); }
  };
  const initial = {
    streamId: "host-live-1",
    sessionId: "w1",
    sequence: 1,
    state: "idle",
    messages: [
      { role: "user", content: [{ type: "text", text: "earlier prompt" }], timestamp: 1000 },
      { role: "assistant", content: [{ type: "text", text: "earlier reply" }], stopReason: "stop", timestamp: 1001 },
    ],
    messageEntryIds: ["e0", "e1"],
    historyThrough: "e1",
    recentOperations: [],
  };
  globalThis.fetch = async (path, init) => {
    if (String(path).endsWith("/history-page?through=e6")) return { ok: true, status: 200, text: async () => JSON.stringify(await anchoredPage.promise) };
    if (String(path).endsWith("/send") && init?.method === "POST") {
      return { ok: true, status: 200, text: async () => JSON.stringify({ accepted: true, operationId: "op-1" }) };
    }
    if (String(path).endsWith("/sessions/w1")) {
      return { ok: true, status: 200, text: async () => JSON.stringify(initial) };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify({}) };
  };
  const store = createWorkbenchStore();
  let sequence = initial.sequence;
  return {
    store,
    initial,
    anchoredPage,
    sessionEvents: () => sources.find((source) => source.url.endsWith("/sessions/w1/events")),
    host(events, type, details = {}, extra = {}) {
      events.emit("host", {
        streamId: initial.streamId,
        sequence: ++sequence,
        sessionId: "w1",
        type,
        operationId: "op-1",
        timestamp: "2026-11-11T07:30:00.000Z",
        details,
        ...extra,
      });
      return sequence;
    },
    cleanup() {
      store.dispose();
      globalThis.EventSource = previousEventSource;
      globalThis.fetch = previousFetch;
    },
  };
}

function summarize(messages) {
  return messages.map((message) => ({
    role: message.role,
    parts: message.content.map((part) => part.type === "tool-call" ? `tool:${part.toolName}` : part.text),
  }));
}

test("sent user message appears immediately on message_end before the model outputs, and preserves steer order across tool steps", async () => {
  const h = createLiveHarness();
  try {
    h.store.start();
    await new Promise((done) => setTimeout(done, 0));
    await h.store.actions.selectSession("w1");
    const events = h.sessionEvents();
    events.emit("snapshot", h.initial);

    h.store.actions.setDraft("first live prompt");
    const sent = await h.store.actions.sendMessage("first live prompt");
    assert.equal(sent, true);
    assert.equal(h.store.getSnapshot().draft, "");

    const userMsg1 = { role: "user", content: [{ type: "text", text: "first live prompt" }], timestamp: 2000 };
    h.host(events, "request_accepted", { queue: "initial" }, { requestId: "r1" });
    h.host(events, "state_changed", { state: "running", operation: { operationId: "op-1", startedAt: "2026-11-11T07:30:00.000Z" } });
    h.host(events, "operation_started");
    h.host(events, "session_event", { sdkType: "message_start", message: userMsg1 });

    let notifiedOnUserEnd = 0;
    const unsubscribe = h.store.subscribe(() => { notifiedOnUserEnd += 1; });
    h.host(events, "session_event", { sdkType: "message_end", message: userMsg1 });
    unsubscribe();

    assert.ok(notifiedOnUserEnd >= 1, "user message_end notifies subscribers immediately without waiting for model output");
    assert.deepEqual(summarize(projectConversation(h.store.getSnapshot())), [
      { role: "user", parts: ["earlier prompt"] },
      { role: "assistant", parts: ["earlier reply"] },
      { role: "user", parts: ["first live prompt"] },
    ]);

    // A retried transient failure clears partial stream text and leaves no ghost assistant turn.
    h.host(events, "message", {}, { text: "doomed partial" });
    h.host(events, "session_event", {
      sdkType: "message_end",
      message: { role: "assistant", content: [{ type: "text", text: "doomed partial" }], stopReason: "error", errorMessage: "429", timestamp: 2001 },
    });
    assert.deepEqual(summarize(projectConversation(h.store.getSnapshot())).map((row) => row.role), ["user", "assistant", "user"]);

    // Step 1: assistant streams text and calls a tool, then user steers mid-operation before Step 2 replies.
    h.host(events, "message", {}, { text: "checking logs" });
    const assistantStep1 = {
      role: "assistant",
      content: [
        { type: "text", text: "checking logs" },
        { type: "toolCall", id: "call-1", name: "bash", arguments: { command: "uptime" } },
      ],
      stopReason: "toolUse",
      timestamp: 2002,
    };
    h.host(events, "session_event", { sdkType: "message_end", message: assistantStep1 });
    assert.equal(projectConversation(h.store.getSnapshot()).at(-1)?.status?.type, "running", "toolUse step stays running before tool_execution_start");
    h.host(events, "session_event", { sdkType: "tool_execution_start", toolCallId: "call-1", toolName: "bash", args: { command: "uptime" } });
    h.host(events, "session_event", { sdkType: "tool_execution_end", toolCallId: "call-1", toolName: "bash", result: { content: [{ type: "text", text: "up 3 days" }] }, isError: false });
    const toolResult1 = { role: "toolResult", toolCallId: "call-1", toolName: "bash", content: [{ type: "text", text: "up 3 days" }], isError: false, timestamp: 2003 };
    h.host(events, "session_event", { sdkType: "message_end", message: toolResult1 });
    assert.equal(projectConversation(h.store.getSnapshot()).at(-1)?.status?.type, "running", "turn stays running between finished tool step and next model response");

    const steerUserMsg = { role: "user", content: [{ type: "text", text: "also check disk" }], timestamp: 2004 };
    h.host(events, "session_event", { sdkType: "message_end", message: steerUserMsg });
    h.host(events, "message", {}, { text: "all clear" });

    assert.deepEqual(summarize(projectConversation(h.store.getSnapshot())), [
      { role: "user", parts: ["earlier prompt"] },
      { role: "assistant", parts: ["earlier reply"] },
      { role: "user", parts: ["first live prompt"] },
      { role: "assistant", parts: ["checking logs", "tool:bash"] },
      { role: "user", parts: ["also check disk"] },
      { role: "assistant", parts: ["all clear"] },
    ]);

    const assistantStep2 = { role: "assistant", content: [{ type: "text", text: "all clear" }], stopReason: "stop", timestamp: 2005 };
    h.host(events, "session_event", { sdkType: "message_end", message: assistantStep2 });
    const endSequence = h.host(events, "operation_completed", { operationId: "op-1", status: "completed" });
    events.emit("host", { type: "snapshot", streamId: h.initial.streamId, sessionId: "w1", sequence: endSequence, details: { snapshot: {
      streamId: h.initial.streamId, sessionId: "w1", sequence: endSequence, state: "idle", historyThrough: "e6",
      recentOperations: [{ operationId: "op-1", status: "completed" }],
    } } });
    const next = { role: "user", content: [{ type: "text", text: "next turn" }], timestamp: 2006 };
    h.host(events, "state_changed", { state: "running", operation: { operationId: "op-2", startedAt: 2006 } }, { operationId: "op-2" });
    const nextSequence = h.host(events, "session_event", { sdkType: "message_end", message: next }, { operationId: "op-2" });
    h.anchoredPage.resolve({
      messages: [...h.initial.messages, userMsg1, assistantStep1, toolResult1, steerUserMsg, assistantStep2],
      messageEntryIds: ["e0", "e1", "e2", "e3", "e4", "e5", "e6"],
      historyBefore: null, historyForkBefore: null, compactions: [], compactionEntryIds: [],
    });
    await new Promise((done) => setTimeout(done, 0));
    const snapshot = h.store.getSnapshot().session.snapshot;
    assert.equal(snapshot.sequence, nextSequence, "the earlier page must not rewind stream state");
    assert.equal(snapshot.operation.operationId, "op-2");
    assert.equal(snapshot.messageEntryIds.at(-1), "e6");

    assert.deepEqual(summarize(projectConversation(h.store.getSnapshot())), [
      { role: "user", parts: ["earlier prompt"] },
      { role: "assistant", parts: ["earlier reply"] },
      { role: "user", parts: ["first live prompt"] },
      { role: "assistant", parts: ["checking logs", "tool:bash"] },
      { role: "user", parts: ["also check disk"] },
      { role: "assistant", parts: ["all clear"] },
      { role: "user", parts: ["next turn"] },
    ]);
  } finally {
    h.cleanup();
  }
});

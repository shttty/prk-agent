// Kernel telemetry frames must not change the inputs of the extension UI render; plugin-UI events must.
import assert from "node:assert/strict";
import { createWorkbenchStore } from "../../web/workbench/store/assemble-workbench-store.js";
import { extensionUiRefreshKey } from "../../web/chat/extension-ui/extension-ui-refresh-key.js";
import { extensionUiRenderTriggerKey } from "../../web/chat/extension-ui/extension-ui-render-trigger-key.js";

const sources = [];
globalThis.EventSource = class extends EventTarget {
  constructor(url) {
    super(); this.url = url; this.readyState = 1; sources.push(this);
    // The collection subscription's first frame is the workbench base.
    queueMicrotask(() => { this.dispatchEvent(new Event("open")); if (url.endsWith("/sessions/events")) this.emit("snapshot", replies["/api/workbench"]); });
  }
  close() { this.readyState = 2; }
  emit(type, value) { this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(value) })); }
};
const variables = [{ name: "x", type: "int" }];
const initial = { streamId: "host-live-1", sessionId: "w1", sequence: 5, state: "idle", messages: [], extensionUi: { revision: 1 },
  kernel: { state: "idle", kernelId: "k", memory: { current: 1 }, namespace: { variables } } };
const replies = {
  "/api/workbench": { targets: [], sessions: [{ sessionId: "w1", state: "idle", target: "t" }] },
  "/api/ui": { extensionUiRenderIntervalMs: 60 },
  "/api/sessions/w1": initial,
};
globalThis.fetch = async (path) => ({ ok: true, status: 200, text: async () => JSON.stringify(replies[path] ?? {}) });

const store = createWorkbenchStore();
store.start();
await new Promise((done) => setTimeout(done, 0));
await store.actions.selectSession("w1");
const events = sources.find((source) => source.url.endsWith("/sessions/w1/events"));
events.emit("snapshot", initial);
const key = () => extensionUiRefreshKey(store.getSnapshot());
const renderKey = () => extensionUiRenderTriggerKey(store.getSnapshot(), { width: 80, height: 40 });
const before = key();
const beforeRender = renderKey();
events.emit("snapshot", { ...initial, messages: [{ role: "assistant", content: [{ type: "text", text: "snapshot-only update" }] }], kernel: { ...initial.kernel, memory: { current: 99 } } });
assert.equal(renderKey(), beforeRender, "snapshot-only kernel/stream changes must not request extension UI rendering");
let sequence = 5;
const host = (type, details) => events.emit("host", { streamId: initial.streamId, sequence: ++sequence, sessionId: "w1", type, timestamp: "2026-10-14T00:00:00Z", details });

for (let tick = 0; tick < 5; tick++) host("state_changed", { kernel: { state: "busy", kernelId: "k", memory: { current: 2 + tick } } });
host("state_changed", { kernel: { state: "idle", kernelId: "k", lastOutcome: "ok" } });
assert.equal(key(), before, "kernel telemetry must not change the render inputs");
const kernel = store.getSnapshot().session.snapshot.kernel;
assert.equal(kernel.state, "idle");
assert.deepEqual(kernel.namespace.variables, variables, "an omitted namespace keeps the last list of the same live kernel");

host("state_changed", { kernel: { state: "unavailable", kernelId: "k" } });
assert.equal(store.getSnapshot().session.snapshot.kernel.namespace, undefined, "a lost kernel keeps no namespace");
assert.equal(key(), before);

host("state_changed", { state: "running" });
const afterState = key();
assert.notEqual(afterState, before, "session state change still re-renders");
host("session_event", { sdkType: "tool_execution_start", toolCallId: "c1", toolName: "python" });
assert.notEqual(key(), afterState, "tool events still re-render");
const afterTool = key();
host("extension_ui", { extensionUi: { revision: 2 } });
assert.notEqual(key(), afterTool, "extension UI revision still re-renders");
replies["/api/sessions/w1/native"] = { status: "completed", data: { streamId: initial.streamId, revision: 2 } };
await store.actions.extensionUiAction("render", { width: 80, height: 40 });
events.emit("snapshot", { streamId: "host-sleeping", sessionId: "w1", sequence: 0, state: "sleeping", messages: [] });
assert.equal(store.getSnapshot().session.extensionUi, null, "A snapshot without a UI host clears the old UI instead of waiting for its first render");
assert.equal(store.getSnapshot().session.extensionUiRender, null, "A removed UI host leaves no rendered components");
events.emit("snapshot", { ...initial, streamId: "host-live-2" });
assert.equal(store.getSnapshot().session.extensionUi.revision, 1, "A rebuilt host starts its own revision after sleep");
store.dispose();
console.log("PASS extension UI render trigger: kernel telemetry excluded, session/tool/extension events included");

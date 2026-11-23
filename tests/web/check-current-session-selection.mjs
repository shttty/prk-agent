import assert from "node:assert/strict";
import { createWorkbenchStore } from "../../web/workbench/store/assemble-workbench-store.js";

const globals = ["EventSource", "fetch", "location", "history"];
const originals = new Map(globals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
const requests = [];
const sources = [];
const current = { sessionId: "w1", streamId: "live-s1", sequence: 1, state: "idle", messages: [], extensionUi: { revision: 1 } };
const closed = { sessionId: "w2", streamId: "closed-s2", sequence: 0, state: "closed", messages: [{ role: "user", content: "saved message" }] };
const sessions = [{ sessionId: "w1", target: "t", state: "idle" }, { sessionId: "w2", target: "t", state: "closed" }];
const reply = (value) => ({ ok: true, status: 200, text: async () => JSON.stringify(value) });
let store;
try {
  globalThis.location = new URL("http://localhost/#sessionId=w1");
  globalThis.history = { state: null, replaceState(_state, _title, url) { globalThis.location = new URL(url); } };
  globalThis.EventSource = class extends EventTarget {
    constructor(url) {
      super(); this.url = url; this.readyState = 1; sources.push(this);
      // Each subscription's first frame is its snapshot: the workbench base, or the selected session's base.
      const base = { "/api/sessions/events": { targets: [], sessions, archive: [] }, "/api/sessions/w1/events": current }[url];
      queueMicrotask(() => {
        this.dispatchEvent(new Event("open"));
        if (base) this.dispatchEvent(new MessageEvent("snapshot", { data: JSON.stringify(base) }));
      });
    }
    close() { this.readyState = 2; }
  };
  globalThis.fetch = async (path, options = {}) => {
    const url = new URL(path, globalThis.location);
    const body = options.body ? JSON.parse(options.body) : null;
    requests.push({ url, body });
    switch (url.pathname) {
      case "/api/ui": return reply({ extensionUiRenderIntervalMs: 60 });
      case "/api/models": return reply({ models: [] });
      case "/api/sessions/w2/history": return reply({ session: sessions[1], snapshot: closed, readOnly: true });
      case "/api/sessions/w1/tool-content": return reply({ sessionId: "w1", toolCallId: "c1", input: "source", output: "result" });
      case "/api/sessions/w1/native":
      case "/api/sessions/w2/native":
        return reply(body
          ? { requestId: body.requestId, action: body.action, status: "completed", data: { streamId: current.streamId, revision: 1, candidates: [] } }
          : { commands: [], actions: [], target: { sessionId: url.pathname.includes("w1") ? "w1" : "w2" } });
      default: throw new Error(`Unexpected request: ${path}`);
    }
  };
  store = createWorkbenchStore();
  assert.equal(store.start(), true);
  for (let turn = 0; turn < 5; turn++) await new Promise((done) => setTimeout(done, 0));
  assert.equal(store.getSnapshot().selectedSessionId, "w1");
  assert.equal(store.getSnapshot().session.snapshot.sessionId, "w1", "the hash selects the native session directly");
  assert.equal("viewSessionId" in store.getSnapshot(), false, "there is no historical-view selection state");
  assert(sources.some((source) => source.url === "/api/sessions/w1/events"), "current route selection still opens its live stream");
  assert.equal(await store.actions.executeNativeAction("help", {}, { transcript: false }), true);
  assert(await store.actions.nativeData("session"));
  assert.deepEqual(await store.actions.loadReferenceCandidates(""), []);
  assert(await store.actions.extensionUiAction("render", { width: 80, height: 24 }));
  assert.equal((await store.actions.loadToolContent("c1")).output, "result");
  assert.equal(await store.actions.selectSession("w2"), true);
  assert.equal(store.getSnapshot().session.snapshot.sessionId, "w2");
  assert.equal(store.getSnapshot().session.snapshot.messages[0].content, "saved message", "closed sessions keep their SDK transcript");
  assert.equal(store.getSnapshot().session.connection, "disconnected");
  assert(requests.some(({ url }) => url.pathname === "/api/sessions/w2/history"), "ordinary closed-session history remains reachable");
  const tool = requests.find(({ url }) => url.pathname.endsWith("/tool-content"));
  assert.deepEqual([...tool.url.searchParams], [["toolCallId", "c1"]], "the route and tool call identify tool content");
  assert(requests.every(({ url, body }) => !url.searchParams.has("sessionId") && (!body || !Object.hasOwn(body, "sessionId"))), "native and history requests never select a second session identity");
} finally {
  store?.dispose();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}
console.log("PASS current session selection: route-only native and tool requests, native hash selection, closed transcript retained");

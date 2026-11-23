import assert from "node:assert/strict";
import test from "node:test";
import { sessionListRows } from "../../../../web/chat/tool-text/session-list-rows.js";

const compact = [
  { sessionId: "native-parent", sessionName: "Parent label", state: "idle", parentSessionId: null, root: true },
  { sessionId: "native-child", sessionName: "Child label", state: "running", parentSessionId: "native-parent", pendingParentSessionId: "native-receiver", supervisor: true },
];

test("compact details, structured results and historical text normalize the same native list", () => {
  const rows = sessionListRows({ details: compact });
  assert.deepEqual(sessionListRows({ structuredContent: compact }), rows);
  assert.deepEqual(sessionListRows({ content: [{ type: "text", text: JSON.stringify(compact) }] }), rows);
  assert.deepEqual(rows.map(({ sessionId, sessionName, parentSessionId, pendingParentSessionId, root, supervisor }) => ({ sessionId, sessionName, parentSessionId, pendingParentSessionId, root, supervisor })), [
    { sessionId: "native-parent", sessionName: "Parent label", parentSessionId: null, pendingParentSessionId: "", root: true, supervisor: false },
    { sessionId: "native-child", sessionName: "Child label", parentSessionId: "native-parent", pendingParentSessionId: "native-receiver", root: false, supervisor: true },
  ]);
  assert(rows.every(({ createdBy, projectId, worker }) => !createdBy && !projectId && !worker), "Compact results invent no legacy metadata");
});

test("removed routing-name list JSON is not accepted as a native session list", () => {
  const old = [{ name: "native-old", worker: "old-route", label: "Old label", state: "sleeping", owner: "old-parent", pendingOwner: "old-receiver", createdBy: "old-creator", projectId: "old-project", derivation: { phase: "working" } }];
  const row = sessionListRows({ content: [{ type: "text", text: JSON.stringify(old) }] });
  assert.equal(row, null);
});

test("targeted observation remains generic output instead of being treated as a session list", () => {
  const observation = { sessionId: "native-child", sessionName: "Child label", state: "running", parentSessionId: "native-parent", recent: [{ role: "assistant", text: "Fresh current turn" }] };
  for (const result of [{ details: observation }, { structuredContent: observation }, { content: [{ type: "text", text: JSON.stringify(observation) }] }]) assert.equal(sessionListRows(result), null);
  assert.deepEqual(sessionListRows({ details: [] }), []);
});

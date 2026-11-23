import assert from "node:assert/strict";
import test from "node:test";
import { spawnedChildren } from "../../../../web/chat/transcript/spawn/spawned-children.js";

const spawn = (id, name) => ({ type: "tool-call", toolCallId: id, toolName: "session_spawn", result: { role: "toolResult", details: { children: [{ index: 0, sessionId: `s-${name}`, sessionName: `Label ${name}`, taskId: `t-${name}` }], errors: [] } } });

test("a turn's spawned children join the live workbench rows; archived ones are counted, not invented", () => {
  const parts = [{ type: "text", text: "go" }, spawn("a", "c1"), spawn("b", "c2"), spawn("c", "c3"), spawn("d", "c1"), { type: "tool-call", toolName: "bash", result: { details: { name: "x" } } }, { type: "tool-call", toolName: "session_spawn" }];
  const sessions = new Map([
    ["s-c1", { sessionId: "s-c1", label: "Bench", target: "gpu", state: "running", derivation: { phase: "working" } }],
    ["s-c2", { sessionId: "s-c2", label: "Logs", target: "alpha", state: "idle", derivation: { phase: "delivered", result: { id: "r", summary: "3 files cleaned", artifacts: [] } } }],
  ]);
  const { total, rows } = spawnedChildren(parts, sessions, [{ id: "alpha", label: "Alpha" }]);
  assert.equal(total, 3, "c1 twice counts once; a call without a result is not a child yet");
  assert.deepEqual(rows.map((row) => [row.sessionId, row.place, row.state.key, row.summary]), [["s-c1", "gpu", "running", ""], ["s-c2", "Alpha", "delivered", "3 files cleaned"]]);
});

test("historical single and batch native outputs resolve their original workbench rows", () => {
  const parts = [
    { type: "tool-call", toolCallId: "old-single", toolName: "session_spawn", result: { details: { sessionId: "native-one", taskId: "task-one" } } },
    { type: "tool-call", toolCallId: "old-batch", toolName: "session_spawn", result: { details: { children: [{ sessionId: "native-two", taskId: "task-two" }] } } },
  ];
  const sessions = new Map([
    ["native-one", { sessionId: "native-one", label: "Historical one", state: "idle" }],
    ["native-two", { sessionId: "native-two", label: "Historical two", state: "idle" }],
  ]);
  assert.deepEqual(spawnedChildren(parts, sessions, []).rows.map(({ sessionId, label }) => [sessionId, label]), [["native-one", "Historical one"], ["native-two", "Historical two"]]);
});

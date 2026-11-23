import assert from "node:assert/strict";
import test from "node:test";
import { hostMemory } from "../../../../web/monitor/readings/host-memory.js";
import { childSessions } from "../../../../web/monitor/readings/child-sessions.js";

const G = 1024 ** 3;

test("plugin host memory reads the working set against a numeric or systemd limit", () => {
  assert.deepEqual(hostMemory({ state: "running", memory: { workingSet: G / 4, memoryMax: G, oomKill: 0 } }), { used: G / 4, limit: G, percent: 25, oomKill: 0 });
  assert.equal(hostMemory({ state: "running", memory: { workingSet: G / 2, memoryMax: "1G", oomKill: 2 } }).percent, 50);
  assert.equal(hostMemory({ state: "running", memory: { workingSet: G, memoryMax: "max", oomKill: 0 } }).percent, null, "unlimited scope: no percentage");
  assert.equal(hostMemory({ state: "replacing" }), null, "no sample yet");
  assert.equal(hostMemory(null), null);
});

test("child sessions are the ones this session manages, with their machine and one state", () => {
  const sessions = new Map([
    ["main", { sessionId: "main", label: "Main", target: "alpha" }],
    ["c1", { sessionId: "c1", label: "Bench", target: "gpu", state: "running", derivation: { owner: "main", phase: "working" } }],
    ["c2", { sessionId: "c2", label: "Logs", target: "alpha", state: "idle", derivation: { owner: "main", phase: "submitted" } }],
    ["c3", { sessionId: "c3", label: "Other", target: "alpha", state: "idle", derivation: { owner: "elsewhere", phase: "working" } }],
  ]);
  const rows = childSessions(sessions, "main", [{ id: "alpha", label: "Alpha" }]);
  assert.deepEqual(rows.map((row) => [row.sessionId, row.place, row.state.key]), [["c1", "gpu", "running"], ["c2", "Alpha", "delivered"]]);
});

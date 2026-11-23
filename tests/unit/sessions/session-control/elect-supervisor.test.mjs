import assert from "node:assert/strict";
import { test } from "node:test";
import { electSupervisor } from "../../../../src/sessions/session-control/elect-supervisor.ts";

const candidates = [
  { sessionId: "later", createdAt: 20 },
  { sessionId: "earliest-b", createdAt: 10 },
  { sessionId: "earliest-a", createdAt: 10 },
];

test("first supervisor is the earliest surviving session with deterministic ties", () => {
  assert.equal(electSupervisor(candidates), "earliest-a");
  assert.equal(electSupervisor([...candidates].reverse()), "earliest-a");
  assert.equal(electSupervisor([]), null);
});

test("manual designation survives newer members and restart reconciliation", () => {
  assert.equal(electSupervisor(candidates, "later"), "later");
});

test("departed supervisor is replaced by the earliest surviving member", () => {
  assert.equal(electSupervisor(candidates, "archived-or-moved"), "earliest-a");
  assert.equal(electSupervisor(candidates.filter(({ sessionId }) => sessionId !== "earliest-a"), "earliest-a"), "earliest-b");
  assert.equal(electSupervisor([], "destroyed"), null);
});

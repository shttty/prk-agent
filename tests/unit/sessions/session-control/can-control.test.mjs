import assert from "node:assert/strict";
import { test } from "node:test";
import { canControl } from "../../../../src/sessions/session-control/can-control.ts";

const actor = (sessionId, extra = {}) => ({ sessionId, root: false, supervisor: false, ...extra });
const target = { ownerChain: ["parent", "ancestor"], projectId: "project-a" };

test("parent and every owner-chain ancestor control the target", () => {
  assert.equal(canControl(actor("parent"), target), true);
  assert.equal(canControl(actor("ancestor"), target), true);
});

test("root controls unrelated and ungrouped sessions", () => {
  assert.equal(canControl(actor("root", { root: true }), target), true);
  assert.equal(canControl(actor("root", { root: true }), { ownerChain: [] }), true);
});

test("only the target project's supervisor gains project control", () => {
  assert.equal(canControl(actor("supervisor", { supervisor: true, projectId: "project-a" }), target), true);
  assert.equal(canControl(actor("other", { supervisor: true, projectId: "project-b" }), target), false);
  assert.equal(canControl(actor("ungrouped", { supervisor: true }), { ownerChain: [] }), false);
});

test("reverse ownership, siblings and ordinary project peers have no control", () => {
  assert.equal(canControl(actor("child"), { ownerChain: [] }), false);
  assert.equal(canControl(actor("sibling"), target), false);
  assert.equal(canControl(actor("peer", { projectId: "project-a" }), target), false);
  assert.equal(canControl(actor("pending-owner", { pendingOwner: true }), target), false);
});

import assert from "node:assert/strict";
import test from "node:test";
import { canControl } from "../../../src/sessions/session-control/can-control.ts";
import { isBusy } from "../../../web/chat/conversation/is-busy.js";

test("control follows the owner chain, root, or the same project's supervisor", () => {
  const target = { ownerChain: ["parent", "grandparent"], projectId: "project" };
  const actor = (sessionId, fields = {}) => ({ sessionId, root: false, supervisor: false, ...fields });
  for (const identity of [actor("parent"), actor("grandparent"), actor("root", { root: true }), actor("supervisor", { supervisor: true, projectId: "project" })]) {
    assert.equal(canControl(identity, target), true);
  }
  for (const identity of [actor("sibling", { projectId: "project" }), actor("supervisor", { supervisor: true, projectId: "other" })]) {
    assert.equal(canControl(identity, target), false);
  }
});

test("old acceptance does not override the authoritative session state", () => {
  const busy = (state) => isBusy({ session: { snapshot: { state }, operations: new Map([["old", { accepted: true }]]) } });
  assert.equal(busy("idle"), false);
  assert.equal(busy("sleeping"), false);
  assert.equal(busy("running"), true);
  assert.equal(busy("cancel_requested"), true);
});

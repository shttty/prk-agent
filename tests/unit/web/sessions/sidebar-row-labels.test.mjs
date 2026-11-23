import assert from "node:assert/strict";
import test from "node:test";
import { rowState } from "../../../../web/sessions/sidebar/labels/row-state.js";

test("a child that handed in its result reads delivered until it runs again", () => {
  assert.equal(rowState({ state: "idle", derivation: { phase: "submitted" } }).key, "delivered");
  assert.equal(rowState({ state: "sleeping", derivation: { phase: "delivered" } }).key, "delivered");
  assert.equal(rowState({ state: "running", derivation: { phase: "delivered" } }).key, "running", "busy again wins");
  assert.equal(rowState({ state: "idle", derivation: { phase: "working" } }).key, "idle");
  assert.equal(rowState({ state: "sleeping" }).tone, "sleep");
});

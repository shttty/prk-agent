import assert from "node:assert/strict";
import test from "node:test";
import { rowState } from "../../../web/sessions/sidebar/labels/row-state.js";
import { highestUnder } from "../../../web/sessions/sidebar/grouping/highest-under.js";

test("the sidebar shows the highest-priority state in a folded subtree", () => {
  const stopped = { sessionId: "child", state: "idle", stopped: true };
  const blocked = { ...stopped, sessionId: "grandchild", blocked: true };
  const done = { sessionId: "sibling", state: "idle", done: true };
  const running = { sessionId: "other", state: "running" };
  const background = { sessionId: "background", state: "idle", background: true, done: true };
  const tree = new Map([[stopped.sessionId, [blocked]]]);
  assert.equal(rowState(blocked).tone, "warn");
  assert.equal(rowState(stopped).tone, "error");
  assert.equal(rowState({ state: "idle", retryPending: true }).key, "running");
  assert.equal(highestUnder([running, stopped, done], tree).key, "blocked");
  assert.equal(highestUnder([running, stopped, done]).key, "stopped");
  assert.equal(highestUnder([done, running], tree).key, "running");
  assert.equal(rowState(background).key, "background");
  assert.equal(rowState({ ...background, state: "sleeping" }).key, "done");
  assert.equal(rowState({ ...background, state: "running" }).key, "running");
  assert.equal(highestUnder([background, done, running], tree).key, "running");
  assert.equal(highestUnder([done, background], tree).key, "background");
  assert.equal(highestUnder([background, stopped]).key, "stopped");
  assert.equal(highestUnder([done], tree).key, "done");
  assert.equal(rowState({ ...done, state: "sleeping" }).key, "done");
  assert.equal(rowState({ ...done, state: "running" }).key, "running");
});

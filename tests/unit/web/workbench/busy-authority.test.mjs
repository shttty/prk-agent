import assert from "node:assert/strict";
import test from "node:test";
import { isBusy } from "../../../../web/chat/conversation/is-busy.js";

// A fresh idle observation can drop an older completion from its bounded recentOperations window.
test("an old acceptance receipt does not hold the session busy after authoritative idle", () => {
  const operations = new Map([["old", { accepted: true }]]);
  const state = (snapshot) => ({ session: { snapshot, operations } });
  assert.equal(isBusy(state({ state: "idle" })), false);
  assert.equal(isBusy(state({ state: "running", operation: { operationId: "next" } })), true);
  assert.equal(isBusy(state({ state: "cancel_requested" })), true);
});

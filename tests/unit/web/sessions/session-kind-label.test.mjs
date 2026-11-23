import assert from "node:assert/strict";
import { test } from "node:test";
import { sessionKindLabel } from "../../../../web/sessions/dialogs/session-kind-label.js";

test("only temporary sessions have a lifecycle label", () => {
  assert.notEqual(sessionKindLabel({ lifecycle: "temporary" }), "");
  for (const lifecycle of ["persistent", "user", undefined]) assert.equal(sessionKindLabel({ lifecycle }), "");
});

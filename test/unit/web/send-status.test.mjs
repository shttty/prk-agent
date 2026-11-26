import assert from "node:assert/strict";
import test from "node:test";
import { sendStatusOf } from "../../../web/chat/composer/send-status.js";
import { normalizeUnknownSends } from "../../../web/workbench/session-storage/sanitizing/normalize-unknown-sends.js";

const status = (entries, restoredDraft = null) => sendStatusOf({ submitting: false, sleeping: false, reconnecting: false, restoredDraft, localMessages: new Map(entries) });

test("an unknown send offers resend only while the Gateway's record can still settle it", () => {
  const open = status([["a", { status: "unknown", text: "hi", streamId: "p:h" }]]);
  assert.equal(open.sendStatusState, "unknown");
  assert.equal(open.resendable, true);
  const restarted = status([["a", { status: "unknown", text: "hi", streamId: "p:h", unconfirmable: true }]]);
  assert.equal(restarted.sendStatusState, "unknown");
  assert.equal(restarted.resendable, false);
  assert.notEqual(restarted.sendStatus, open.sendStatus);
  assert.equal(status([["a", { status: "accepted", operationId: "op" }]]).sendStatus, "");
  assert.equal(status([], { count: 1, reason: "undelivered" }).restoredReason, "undelivered");
  assert.equal(status([], { count: 2, operationId: "op" }).restoredReason, "stopped");
});

test("saved unknown sends keep only well-formed receipts", () => {
  assert.deepEqual(normalizeUnknownSends([
    ["a", { text: "hi", streamId: "p:h", unconfirmable: true, extra: 1 }],
    ["b", { text: 3, streamId: "p:h" }],
    ["c", { text: "no stream" }],
    "junk",
  ]), [["a", { text: "hi", streamId: "p:h", unconfirmable: true }]]);
  assert.deepEqual(normalizeUnknownSends(undefined), []);
});

import assert from "node:assert/strict";
import test from "node:test";
import { composerMode } from "../../../../web/chat/composer/composer-mode.js";
import { sendDraft } from "../../../../web/chat/composer/send-draft.js";
import { validateRequest } from "../../../../src/gateway/wire/validate-request.ts";

const image = { name: "pixel.png", type: "image/png", size: 1, data: "AA==", source: "browser" };

test("attachment-only drafts enable sending and use the selected queue", () => {
  const fields = { normalizedComposerText: "", candidateOptions: [], composerText: "", queue: "followUp" };
  assert.equal(composerMode({ ...fields, attachments: [] }).hasDraft, false);
  const mode = composerMode({ ...fields, attachments: [image] });
  assert.equal(mode.hasDraft, true);
  assert.equal(mode.unknownControl, false);
  const sends = [];
  const context = { ...fields, composingRef: { current: false }, selectedSessionId: "s", onSend() {},
    actions: { sendMessage: (...args) => sends.push(args) }, attachments: [], attachedReferences: [], setPlainMode() {}, setHistoryCursor() {} };
  sendDraft(context, mode.queueMode);
  sendDraft({ ...context, attachments: [image] }, mode.queueMode);
  assert.deepEqual(sends, [["", { queue: "followUp", mode: "auto", attachments: [image], references: [] }]]);
});

test("Gateway admits empty text with a valid attachment, not an empty or invalid input", () => {
  const frame = { v: 1, id: 1, method: "send", params: { sessionId: "s", requestId: "r", message: "" } };
  assert.throws(() => validateRequest(frame), /invalid/iu);
  assert.throws(() => validateRequest({ ...frame, params: { ...frame.params, attachments: [] } }), /invalid/iu);
  assert.throws(() => validateRequest({ ...frame, params: { ...frame.params, attachments: [{ ...image, type: "image/svg+xml" }] } }), /invalid/iu);
  const valid = { ...frame, params: { ...frame.params, attachments: [image] } };
  assert.deepEqual(validateRequest(valid), valid);
});

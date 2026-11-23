import assert from "node:assert/strict";
import { test } from "node:test";
import { makeNativeFeedbackMessage } from "../../../../web/chat/conversation/messages/make-native-feedback-message.js";

test("native feedback shows one command, a localized outcome, and only meaningful details", () => {
  const render = (feedback) => makeNativeFeedbackMessage({ command: "compact", action: "compact", ...feedback }, "id", new Date(0)).content[0].text;
  assert.equal(render({ status: "completed", message: "/compact completed.", data: { tokensBefore: 1234, summary: "not repeated here" } }), "/compact · 已完成\n压缩前约 1234 tokens");
  assert.equal(render({ status: "cancelled", command: "/compact", data: { tokensBefore: 1234 } }), "/compact · 已取消");
  assert.equal(render({ status: "failed", message: "Provider refused the request." }), "/compact · 失败\nProvider refused the request.");
  assert.equal(render({ status: "completed", message: "/compact completed." }), "/compact · 已完成");
  assert.equal(render({ command: "clone", action: "clone", status: "completed", message: "/clone completed." }), "/clone · 已完成");
});

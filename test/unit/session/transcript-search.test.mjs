import assert from "node:assert/strict";
import test from "node:test";
import { matchTranscriptMessages } from "../../../web/chat/transcript/match-transcript-messages.js";
import { messageForToolCall } from "../../../web/chat/transcript/tool-calls/kernel-cell/message-for-tool-call.js";

const messages = [
  { id: "user", content: [{ type: "text", text: "Have you checked the ALMANAC?" }] },
  { id: "turn", content: [{ type: "tool-call", toolCallId: "cell-call", argsText: '{"code":"almanac"}', result: { details: { lines: ["Moonrise"] } } }] },
  { id: "note", content: [], metadata: { custom: { compaction: { summary: "Almanac reference" } } } },
];

test("transcript search returns ordered message ids without needing rendered rows", () => {
  assert.deepEqual(matchTranscriptMessages(messages, " Almanac "), ["user", "turn", "note"]);
  assert.deepEqual(matchTranscriptMessages(messages, "moonrise"), ["turn"]);
  assert.deepEqual(matchTranscriptMessages(messages, " "), []);
});

test("kernel navigation resolves a tool call to its enclosing merged turn", () => {
  assert.equal(messageForToolCall(messages, "cell-call"), "turn");
  assert.equal(messageForToolCall(messages, "unknown"), undefined);
});

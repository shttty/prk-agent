import assert from "node:assert/strict";
import { formatPeerMessages } from "../../../shared/session-messages/format-peer-messages.js";
import { parsePeerMessages } from "../../../shared/session-messages/parse-peer-messages.js";
import { contentText } from "../../../web/chat/conversation/content-text.js";
import { projectConversation } from "../../../web/chat/conversation/project-conversation.js";

export function checkDuplexProtocol() {
// B1 protocol/projection checks need no SDK runtime, provider, home or network.
const first = {
  label: "Worker B", sender: "worker-b",
  messageId: "00000000-0000-4000-8000-000000000001", replyTo: "", expectReply: true,
  body: "First question\n\nKeep the paragraph boundary.",
};
const second = {
  label: "Coordinator", sender: "coordinator-c",
  messageId: "00000000-0000-4000-8000-000000000002", replyTo: first.messageId, expectReply: false,
  body: "Answer; no acknowledgment needed.",
};
const third = {
  label: "", sender: "agent-d",
  messageId: "00000000-0000-4000-8000-000000000003", replyTo: second.messageId, expectReply: true,
  body: "Follow-up question.",
};
const single = formatPeerMessages([first]);
const noReply = formatPeerMessages([second]);
assert.deepEqual(parsePeerMessages(single), [first]);
assert.deepEqual(parsePeerMessages(noReply), [second]);
assert.deepEqual(parsePeerMessages(formatPeerMessages([third])), [third], "Unknown sender retains the session envelope");
assert.equal(parsePeerMessages(single.replace('to="worker-b"', 'to="other"')), null);
assert.equal(parsePeerMessages(single.replace('replyTo="00000000-0000-4000-8000-000000000001"', 'replyTo="other"')), null);
assert.equal(parsePeerMessages(noReply.replace('expected for message=00000000-0000-4000-8000-000000000002', 'expected for message=other')), null);

const messages = [first, second, third];
const merged = formatPeerMessages(messages);
const batchId = messages.map((message) => message.messageId).join("+");
const parsed = messages.map((message, index) => ({ ...message, batch: { id: batchId, index, count: 3 } }));
assert.deepEqual(parsePeerMessages(merged), parsed, "Per-member routing, expectations, bodies and stable batch metadata");
const arrived = messages.map((message, index) => ({ ...message, arrival: index + 1 }));
assert.deepEqual(parsePeerMessages(formatPeerMessages([arrived[0]])), [arrived[0]], "Single envelope retains its host-assigned arrival order");
assert.deepEqual(parsePeerMessages(formatPeerMessages(arrived)), parsed.map((message, index) => ({ ...message, arrival: index + 1 })), "Merged envelope retains each host-assigned arrival order");
for (const arrival of [0, Number.MAX_SAFE_INTEGER + 1]) {
  assert.equal(parsePeerMessages(formatPeerMessages([{ ...first, arrival }])), null, "Arrival must be a positive safe integer");
  assert.equal(parsePeerMessages(formatPeerMessages([{ ...first, arrival }, second])), null, "Malformed merged arrival cannot be consumed");
}
assert.equal(parsePeerMessages(single.replaceAll("session-message", "agent-message").replaceAll("session_send", "agent_send")), null, "Legacy envelopes have no parser alias");
assert.equal(parsePeerMessages(single.replace('from worker "', 'from main "')), null, "The removed main role has no parser alias");

const project = (texts) => projectConversation({ selectedSessionId: "receiver", session: { snapshot: { messages: texts.map((text, index) => ({
  id: `sdk-${index}`, role: "user", content: [{ type: "text", text }], timestamp: 1000 + index,
})) }, toolRuns: new Map(), operations: new Map(), streams: new Map(), nativeFeedback: [], } });
const rows = project([single, merged, "Human prompt"]);
assert.deepEqual(rows.map((row) => row.id), ["sdk-0", "sdk-1", "sdk-1:1", "sdk-1:2", "sdk-2"]);
assert.equal(new Set(rows.map((row) => row.id)).size, rows.length, "Projected rows have distinct identities");
assert.deepEqual(rows.map((row) => contentText(row.content)), [first.body, ...messages.map((message) => message.body), "Human prompt"]);
const metadata = (message) => { const { body, ...peer } = message; return peer; };
assert.deepEqual(rows[0].metadata.custom.peerMessage, metadata(first), "Single display metadata is unchanged (no batch)");
assert.deepEqual(rows.slice(1, 4).map((row) => row.metadata.custom.peerMessage), parsed.map(metadata));
assert(rows.every((row) => row.role === "user"));
assert.deepEqual(rows.slice(1, 4).map((row) => row.metadata.custom.sdkTimestamp), [1001, 1001, 1001]);
assert.equal(rows[4].metadata.custom.peerMessage, undefined);

for (const malformed of [
  merged.replace("3 received", "4 received"),
  merged.replace("[2/3 from", "[1/3 from"),
  merged.replace("[2/3 from", "[2/4 from"),
  merged.replace(" / no reply expected]", " / unknown expectation]"),
  merged.replace("\n\n[1/3", "\n\nunframed text\n\n[1/3"),
  merged.replace('Plain replies are not delivered to senders.', 'Not the protocol footer.'),
  merged + "\nextra text",
  "[session-messages: 2 received together, oldest first]\n\nhello",
]) {
  assert.equal(parsePeerMessages(malformed), null, "Malformed batches remain ordinary input");
  const [row] = project([malformed]);
  assert.equal(contentText(row.content), malformed);
  assert.equal(row.metadata.custom.peerMessage, undefined);
}
assert.equal(parsePeerMessages("Human prompt"), null);
console.log("PASS: peer protocol round-trip, routing, expectations, malformed input and conversation projection with batch metadata");
}

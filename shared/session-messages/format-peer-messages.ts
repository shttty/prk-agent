import { MERGED_FOOTER } from "./protocol-constants.js";

/** One entry retains the original single envelope; a backlog lists entries oldest first. */
export function formatPeerMessages(messages) {
  if (messages.length === 0) throw new Error("A peer envelope needs at least one message.");
  const who = (message) => message.label ? `worker "${message.label}"` : "session";
  const routing = (message) => `from ${who(message)} (id=${message.sender}) / message=${message.messageId}${message.replyTo ? ` / replyTo=${message.replyTo}` : ""}${message.arrival === undefined ? "" : ` / arrival=${message.arrival}`}`;
  if (messages.length === 1) {
    const [message] = messages;
    const footer = message.expectReply
      ? `(To answer, call session_send with to="${message.sender}" and replyTo="${message.messageId}". Plain replies are not delivered to the sender.)`
      : `(No reply expected for message=${message.messageId}. Do not answer it with session_send; continue your own work.)`;
    return `[session-message ${routing(message)}]\n\n${message.body}\n\n${footer}`;
  }
  const entries = messages.map((message, index) => `[${index + 1}/${messages.length} ${routing(message)} / ${message.expectReply ? "expects reply" : "no reply expected"}]\n\n${message.body}`);
  return `[session-messages: ${messages.length} received together, oldest first]\n\n${entries.join("\n\n")}${MERGED_FOOTER}`;
}


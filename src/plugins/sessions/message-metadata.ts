export const SESSION_MESSAGE_TOOL_METADATA = {
  session_list: {
    name: "session_list",
    description: "List reachable sessions, including the caller marked self: true. Rows contain sessionId, sessionName, state, parentSessionId and optional pendingParentSessionId. The designated root and project supervisors have root: true and supervisor: true, respectively; otherwise those fields are omitted. Specify sessionId to inspect that controlled session's status, submitted result and recent messages/tool activity without waking it. Inspection permits self, owner-chain ancestors, the target project's supervisor or global root; peers cannot inspect each other. Results and messages still arrive automatically; do not poll for completion.",
  },
  session_send: {
    name: "session_send",
    description: "Send a direct text message to another session by sessionId (from session_spawn or session_list). Returns acceptance immediately, never waits "
      + "for the recipient's turn or answer. delivery defaults to steer: busy recipients receive it at their next turn_end. "
      + "followUp waits until the entire run has no more tool calls or steering messages. abort requires control authority, cancels the active run/tool "
      + "and delivers all pending messages together in a new turn, preserving the kernel. Backlogs merge oldest first. "
      + "Answer only entries asking for a reply, using that entry's sender id and message id as to/replyTo. A reply expects no answer "
      + "by default; set expectReply=true only for a real question. Answer each message only once; send a new message to add more. "
      + "Replies to no-reply messages are refused. Continue your own work.",
  },
};

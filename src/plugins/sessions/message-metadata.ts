export const SESSION_MESSAGE_TOOL_METADATA = {
  session_list: {
    name: "session_list",
    description: "List reachable sessions (self: true), or inspect a controlled sessionId's status, result, and recent activity without waking.",
  },
  session_send: {
    name: "session_send",
    description: "Queue a message to a sessionId. delivery: steer (default) next turn boundary; followUp after run; abort (needs control) cancels active run/tool and starts a new turn preserving kernel. Reply once to expectReply messages via to/replyTo.",
  },
};

export const DERIVED_TOOL_METADATA = {
  session_spawn: {
    name: "session_spawn",
    description: "Spawn child sessions for independent tasks; returns admission {children, errors}. Route by sessionId; retry only failed tasks. Results and failure notices wake you automatically—wait without polling; steer, retry, or destroy failed children.",
  },
  session_result: {
    name: "session_result",
    description: "Submit your task result to the parent's inbox (plain replies are not delivered). Cite file:line and commands with exit codes; output is validated against outputSchema. Destroy/transfer owned children first; temporary sessions archive on delivery.",
  },
  session_manage: {
    name: "session_manage",
    description: "Destroy a controlled subtree, offer/accept child transfer, set project, or (root only) set supervisor by sessionId. Needs ancestor, supervisor, or root control; accept needs a pending offer to you.",
  },
};

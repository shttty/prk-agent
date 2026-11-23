export const DERIVED_TOOL_METADATA = {
  session_spawn: {
    name: "session_spawn",
    description: "Create sessions for self-contained assignments in tasks[] with shared context. Returns admission only: {children:[{index,sessionId,sessionName,taskId}],errors:[{index,error}]}; errors=[] means every task was admitted, not completed. Use sessionId for all session messaging and management; sessionName is the display label, and taskId identifies the submitted task result. Keep returned identities and never replay accepted tasks or the whole batch after partial admission. Results arrive automatically as messages and wake an idle parent; no polling or confirmation tools are needed.",
  },
  session_result: {
    name: "session_result",
    description: "Finish your assigned task with summary, optional artifacts and structured output. If assigned outputSchema, output is required and validated before saving or delivery. Include file:line evidence and commands with exit codes. The result is delivered through the parent's inbox; a temporary child is then stopped and archived automatically. No confirmation tool is required. Destroy, transfer or upgrade children you still own first; ordinary assistant replies do not finish the task.",
  },
  session_manage: {
    name: "session_manage",
    description: "Manage sessions by sessionId: destroy a controlled session and its owned subtree; offer transfer of a child to another sessionId; accept a transfer addressed to you; change a controlled session's project; or, as root only, designate that session as its project's supervisor. child, to and session always identify sessions by sessionId. Control requires an owner-chain ancestor, root, or the target project's supervisor. Accept is authorized only by a pending offer addressed to this session. Transfer preserves creator, task and history; ownership changes only on acceptance.",
  },
};

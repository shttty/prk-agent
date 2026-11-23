/** Whether a workbench session is the global root / its project's supervisor, from the Gateway's role snapshot. */
export function sessionRoles(control, sessionRow) {
  const id = sessionRow?.sessionId;
  if (!control || !id) return { root: false, supervisor: false };
  return { root: control.rootSessionId === id, supervisor: Boolean(sessionRow.projectId) && control.supervisors[sessionRow.projectId] === id };
}

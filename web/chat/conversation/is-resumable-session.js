/** A closed or unavailable sessionRow that will get a kernel back on the next message. */
export function isResumableSession(state) {
  const sessionRow = state.sessions.get(state.selectedSessionId);
  const dormant = (value) => value === "closed" || value === "unavailable";
  return Boolean(sessionRow && (dormant(sessionRow.state) || dormant(state?.session?.snapshot?.state)));
}

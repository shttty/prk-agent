/** A closed or unavailable sessionRow that will get a kernel back on the next message. */
export function isResumableSession(state: { selectedSessionId?: string | null; sessions: Map<string, { state?: string }>; session?: { snapshot?: { state?: string } | null } }) {
  const sessionRow = state.selectedSessionId ? state.sessions.get(state.selectedSessionId) : undefined;
  const dormant = (value: string | undefined) => value === "closed" || value === "unavailable";
  return Boolean(sessionRow && (dormant(sessionRow.state) || dormant(state.session?.snapshot?.state)));
}

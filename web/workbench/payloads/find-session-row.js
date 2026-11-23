export function findSessionRow(state, sessionId) {
  const current = state.sessions.get(sessionId);
  if (current) return current;
  for (const group of state.archive) {
    const row = group.sessions.find((item) => item.sessionId === sessionId);
    if (row) return row;
  }
}

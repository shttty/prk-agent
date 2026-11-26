import type { SelectedRow, WorkbenchState } from "../store/store-types.ts";

/** The listed session, or the archived one of that id (archived rows carry less). */
export function findSessionRow(state: WorkbenchState, sessionId: string | null): SelectedRow | undefined {
  if (sessionId === null) return undefined;
  const current = state.sessions.get(sessionId);
  if (current) return current;
  for (const group of state.archive) {
    const row = group.sessions.find((item) => item.sessionId === sessionId);
    if (row) return row;
  }
  return undefined;
}

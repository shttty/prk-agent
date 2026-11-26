import type { SessionRow, WorkbenchState } from "../store/store-types.ts";

/** The selected session's row when it is in the list (an archived or no selection has none). */
export function selectedListedRow(state: WorkbenchState): SessionRow | undefined {
  return state.selectedSessionId === null ? undefined : state.sessions.get(state.selectedSessionId);
}

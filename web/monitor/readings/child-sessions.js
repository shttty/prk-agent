import { rowState } from "../../sessions/sidebar/labels/row-state.js";
/** The sessions `owner` manages (derivation.owner), newest first as the workbench lists them, each with where it runs
 * and the one state the sidebar shows for it. */
export function childSessions(sessions, owner, targets) {
  const labelOf = (name) => targets.find((target) => target.id === name)?.label || name || "";
  return [...sessions.values()].filter((sessionRow) => sessionRow.derivation?.owner === owner && sessionRow.sessionId !== owner)
    .map((sessionRow) => ({ sessionId: sessionRow.sessionId, label: sessionRow.label || sessionRow.sessionId, place: labelOf(sessionRow.target), state: rowState(sessionRow), startedAt: sessionRow.startedAt, finishedAt: sessionRow.finishedAt }));
}

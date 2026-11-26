import type { PublicExecutionTarget } from "../../../src/gateway/wire/web-types.ts";
import type { SessionRows } from "../../sessions/session-row-types.ts";
import { rowState, type RowState } from "../../sessions/sidebar/labels/row-state.ts";

export type ChildSession = { sessionId: string; label: string; place: string; state: RowState; startedAt?: number; finishedAt?: number };

/** The sessions `owner` manages (derivation.owner), newest first as the workbench lists them, each with where it runs
 * and the one state the sidebar shows for it. */
export function childSessions(sessions: SessionRows, owner: string, targets: readonly PublicExecutionTarget[]): ChildSession[] {
  const labelOf = (name: string) => targets.find((target) => target.id === name)?.label || name;
  return [...sessions.values()].filter((sessionRow) => sessionRow.derivation?.owner === owner && sessionRow.sessionId !== owner)
    .map((sessionRow) => ({ sessionId: sessionRow.sessionId, label: sessionRow.label || sessionRow.sessionId, place: labelOf(sessionRow.target), state: rowState(sessionRow), startedAt: sessionRow.startedAt, finishedAt: sessionRow.finishedAt }));
}

import { rowState } from "../../../sessions/sidebar/labels/row-state.js";
export const SPAWN_TOOL = "session_spawn";

/** Join spawned native identities with current workbench rows; archived children count too. */
export function spawnedChildren(parts, sessions, targets) {
  const names = [];
  for (const part of parts) {
    if (part?.type !== "tool-call" || part.toolName !== SPAWN_TOOL) continue;
    const details = (part.result?.result || part.result)?.details;
    const children = Array.isArray(details?.children) ? details.children : [details];
    for (const child of children) {
      const id = child?.sessionId;
      if (typeof id === "string" && id && !names.includes(id)) names.push(id);
    }
  }
  const placeOf = (name) => targets.find((target) => target.id === name)?.label || name || "";
  const rows = names.flatMap((name) => {
    const sessionRow = sessions?.get(name);
    if (!sessionRow) return [];
    const result = sessionRow.derivation?.result;
    return [{ sessionId: sessionRow.sessionId, label: sessionRow.label || name, place: placeOf(sessionRow.target), state: rowState(sessionRow), summary: typeof result?.summary === "string" ? result.summary : "", startedAt: sessionRow.startedAt, finishedAt: sessionRow.finishedAt }];
  });
  return { total: names.length, rows };
}

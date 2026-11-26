import { isPayload } from "../../payload/is-payload.ts";
import type { SessionRow } from "../../../workbench/store/store-types.ts";

import type { MessagePart } from "../../conversation/conversation-types.ts";
import { rowState } from "../../../sessions/sidebar/labels/row-state.js";
export const SPAWN_TOOL = "session_spawn";

export type SpawnRow = { sessionId: string; label: string; place: string; state: { key: string; tone: string; label: string }; summary: string; startedAt?: number; finishedAt?: number };

/** Join spawned native identities with current workbench rows; archived children count too. */
export function spawnedChildren(parts: readonly MessagePart[], sessions: Map<string, SessionRow> | null | undefined, targets: readonly { id: string; label?: string }[]) {
  const names: string[] = [];
  for (const part of parts) {
    if (part.type !== "tool-call" || part.toolName !== SPAWN_TOOL) continue;
    const result = isPayload(part.result?.result) ? part.result.result : part.result;
    const details = result?.details;
    const children: unknown[] = isPayload(details) && Array.isArray(details.children) ? details.children : [details];
    for (const child of children) {
      const id = isPayload(child) ? child.sessionId : undefined;
      if (typeof id === "string" && id && !names.includes(id)) names.push(id);
    }
  }
  const placeOf = (name: string) => targets.find((target) => target.id === name)?.label || name || "";
  const rows = names.flatMap((name): SpawnRow[] => {
    const sessionRow = sessions?.get(name);
    if (!sessionRow) return [];
    const result: unknown = sessionRow.derivation?.result;
    return [{ sessionId: sessionRow.sessionId, label: sessionRow.label || name, place: placeOf(sessionRow.target), state: rowState(sessionRow), summary: isPayload(result) && typeof result.summary === "string" ? result.summary : "", startedAt: sessionRow.startedAt, finishedAt: sessionRow.finishedAt }];
  });
  return { total: names.length, rows };
}

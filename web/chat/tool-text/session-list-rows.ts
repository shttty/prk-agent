import { isPayload } from "../payload/is-payload.ts";
import type { Payload } from "../payload/is-payload.ts";
import { asText } from "./as-text.ts";

export type SessionListRow = { sessionId: string; sessionName: string; state: string; parentSessionId: string | null; pendingParentSessionId: string; createdBy: string; projectId: string; root: boolean; supervisor: boolean };

/** Compact rows identified by native sessionId. */
export function sessionListRows(result: Payload | undefined): SessionListRow[] | null {
  if ([result?.details, result?.structuredContent].some((value) => isPayload(value) && Array.isArray(value.recent))) return null;
  let rows: unknown = Array.isArray(result?.details) ? result.details : Array.isArray(result?.structuredContent) ? result.structuredContent : null;
  if (!rows) {
    const text = Array.isArray(result?.content) ? result.content.filter(isPayload).filter((part) => part.type === "text").map((part) => asText(part.text)).join("") : "";
    // Boundary: the tool result text came off the wire.
    try { rows = JSON.parse(text); } catch { return null; }
  }
  if (!Array.isArray(rows) || !rows.every((row) => isPayload(row) && asText(row.sessionId))) return null;
  return rows.filter(isPayload).map((row) => ({
    sessionId: asText(row.sessionId),
    sessionName: asText(row.sessionName) || asText(row.sessionId),
    state: asText(row.state),
    parentSessionId: row.parentSessionId === null ? null : asText(row.parentSessionId) || null,
    pendingParentSessionId: asText(row.pendingParentSessionId),
    createdBy: asText(row.createdBy), projectId: asText(row.projectId),
    root: row.root === true, supervisor: row.supervisor === true,
  }));
}

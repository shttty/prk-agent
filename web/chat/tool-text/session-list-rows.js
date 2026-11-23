import { isRecord } from "../../workbench/payloads/is-record.js";
import { asText } from "./as-text.js";

/** Compact rows identified by native sessionId. */
export function sessionListRows(result) {
  if ([result?.details, result?.structuredContent].some((value) => isRecord(value) && Array.isArray(value.recent))) return null;
  let rows = Array.isArray(result?.details) ? result.details : Array.isArray(result?.structuredContent) ? result.structuredContent : null;
  if (!rows) {
    const text = Array.isArray(result?.content) ? result.content.filter((part) => part?.type === "text").map((part) => part.text).join("") : "";
    try { rows = JSON.parse(text); } catch { return null; }
  }
  if (!Array.isArray(rows) || !rows.every((row) => isRecord(row) && asText(row.sessionId))) return null;
  return rows.map((row) => ({
    sessionId: asText(row.sessionId),
    sessionName: asText(row.sessionName) || asText(row.sessionId),
    state: asText(row.state),
    parentSessionId: row.parentSessionId === null ? null : asText(row.parentSessionId) || null,
    pendingParentSessionId: asText(row.pendingParentSessionId),
    createdBy: asText(row.createdBy), projectId: asText(row.projectId),
    root: row.root === true, supervisor: row.supervisor === true,
  }));
}

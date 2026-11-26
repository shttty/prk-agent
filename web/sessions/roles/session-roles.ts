import type { SessionControl } from "../../../src/gateway/wire/web-types.ts";
import type { SessionRow } from "../../workbench/store/store-types.ts";

/** Whether a workbench session is the global root / its project's supervisor, from the Gateway's role snapshot. */
export function sessionRoles(control: SessionControl | null, sessionRow: Pick<SessionRow, "sessionId" | "projectId"> | undefined) {
  const id = sessionRow?.sessionId;
  if (!control || !sessionRow || !id) return { root: false, supervisor: false };
  return { root: control.rootSessionId === id, supervisor: Boolean(sessionRow.projectId) && control.supervisors[sessionRow.projectId ?? ""] === id };
}

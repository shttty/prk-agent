import type { SessionControl } from "../../../../src/gateway/wire/web-types.ts";
import { isRecord } from "../../payloads/is-record.ts";

/** Gateway role snapshot `{rootSessionId, supervisors: {projectId: sessionId}}` (native session ids). */
export function normalizeSessionControl(body: unknown): SessionControl {
  const record = isRecord(body) ? body : {};
  const supervisors: Record<string, string> = {};
  if (isRecord(record.supervisors)) {
    for (const [projectId, sessionId] of Object.entries(record.supervisors)) if (typeof sessionId === "string" && sessionId) supervisors[projectId] = sessionId;
  }
  return { rootSessionId: typeof record.rootSessionId === "string" && record.rootSessionId ? record.rootSessionId : null, supervisors };
}

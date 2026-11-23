import { isRecord } from "../../payloads/is-record.js";

/** Gateway role snapshot `{rootSessionId, supervisors: {projectId: sessionId}}` (native session ids). */
export function normalizeSessionControl(body) {
  const supervisors = {};
  if (isRecord(body?.supervisors)) {
    for (const [projectId, sessionId] of Object.entries(body.supervisors)) if (typeof sessionId === "string" && sessionId) supervisors[projectId] = sessionId;
  }
  return { rootSessionId: typeof body?.rootSessionId === "string" && body.rootSessionId ? body.rootSessionId : null, supervisors };
}

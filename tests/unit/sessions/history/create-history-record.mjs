import { DEFAULT_LIMITS_OPTIONS } from "../../../../src/config/limits/limits-options.ts";

export function createHistoryRecord(label, sessionId, customEntries = []) {
  const sessionFile = `/sessions/${sessionId}.jsonl`;
  const entries = [
    { type: "custom", customType: "gateway-session-binding", data: { version: 4, target: "local", cwd: "/project", sessionId } },
    ...customEntries,
  ];
  return {
    sessionId, sessionFile, target: "local", cwd: "/project",
    limits: DEFAULT_LIMITS_OPTIONS,
    manager: {
      getSessionId: () => sessionId,
      getSessionFile: () => sessionFile,
      getSessionName: () => `Title ${label}`,
      getHeader: () => ({ id: sessionId }),
      getEntries: () => entries,
      getBranch: () => [],
      getCwd: () => "/project",
      buildSessionContext: () => ({ model: null, thinkingLevel: "off", messages: [] }),
    },
  };
}

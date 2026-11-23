
export function emptyToolRun(key, sessionId, toolName, operationId, code = "") {
  return {
    key,
    sessionId,
    toolName,
    operationId,
    startedAt: null,
    endedAt: null,
    code,
    output: "",
    result: "",
    isError: false,
    unknown: false,
    ended: false,
  };
}


import type { ToolRun } from "./tool-run-types.ts";

export function emptyToolRun(key: string, sessionId: string, toolName: string, operationId: string, code = ""): ToolRun {
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

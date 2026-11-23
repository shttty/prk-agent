import { isRecord } from "../is-record.js";
import { eventTimestamp } from "./event-timestamp.js";
import { toolKey } from "./tool-key.js";
import { emptyToolRun } from "./empty-tool-run.js";
import { safeText } from "../safe-text.js";
import { toolCode } from "./tool-code.js";
import { exactPrintable } from "./exact-printable.js";
import { unknownToolResult } from "./unknown-tool-result.js";
export function ingestToolEvent(toolRuns, details, sessionId, operationId, timestamp) {
  if (!isRecord(details) || typeof details.sdkType !== "string" || !details.sdkType.startsWith("tool_execution_")) return toolRuns;
  // Calls a tool made through ctx.executeTool() (SDK `parentToolCallId`) are not transcript rows; history keeps them only as `nestedCalls` on the outer result.
  if (details.parentToolCallId) return toolRuns;
  const type = details.sdkType;
  const observedAt = eventTimestamp(timestamp);
  const key = toolKey(details, sessionId, operationId);
  const previous = toolRuns.get(key) || emptyToolRun(key, sessionId || "session", safeText(details.toolName) || "tool", operationId || "");
  const next = {
    ...previous,
    toolName: safeText(details.toolName) || previous.toolName,
    operationId: operationId || previous.operationId,
    ...(details.inputPreview ? { inputPreview: details.inputPreview } : {}),
  };
  if (type === "tool_execution_start") {
    next.startedAt = next.startedAt || observedAt;
    next.code = toolCode(details);
  }
  if (type === "tool_execution_update") {
    next.code = next.code || toolCode(details);
    next.partialResult = details.partialResult;
    next.outputPreview = details.outputPreview || details.partialResult?.outputPreview;
    if (details.partialResult !== undefined) next.output = exactPrintable(details.partialResult);
  }
  if (type === "tool_execution_end") {
    next.code = next.code || toolCode(details);
    next.result = exactPrintable(details.result);
    next.resultValue = details.result;
    next.outputPreview = details.outputPreview || details.result?.outputPreview;
    next.isError = details.isError === true;
    next.unknown = unknownToolResult(details);
    next.endedAt = next.endedAt || observedAt;
    next.ended = true;
  }
  return new Map(toolRuns).set(key, next);
}


import type { ToolRun } from "./tool-run-types.ts";
import { isRecord } from "../is-record.ts";
import { eventTimestamp } from "./event-timestamp.ts";
import { toolKey } from "./tool-key.ts";
import { emptyToolRun } from "./empty-tool-run.ts";
import { safeText } from "../safe-text.ts";
import { toolCode } from "./tool-code.ts";
import { exactPrintable } from "./exact-printable.ts";
import { unknownToolResult } from "./unknown-tool-result.ts";
import { toolPreview } from "./tool-preview.ts";

/** Fold one SDK `tool_execution_*` event (a host `session_event`'s `details`) into the runs; other events return `toolRuns` itself. */
export function ingestToolEvent(toolRuns: Map<string, ToolRun>, details: unknown, sessionId: string | null | undefined, operationId: string | undefined, timestamp: unknown): Map<string, ToolRun> {
  if (!isRecord(details) || typeof details.sdkType !== "string" || !details.sdkType.startsWith("tool_execution_")) return toolRuns;
  // Calls a tool made through ctx.executeTool() (SDK `parentToolCallId`) are not transcript rows; history keeps them only as `nestedCalls` on the outer result.
  if (details.parentToolCallId) return toolRuns;
  const type = details.sdkType;
  const observedAt = eventTimestamp(timestamp);
  const key = toolKey(details, sessionId, operationId);
  const previous = toolRuns.get(key) || emptyToolRun(key, sessionId || "session", safeText(details.toolName) || "tool", operationId || "");
  const inputPreview = toolPreview(details.inputPreview);
  const next: ToolRun = {
    ...previous,
    toolName: safeText(details.toolName) || previous.toolName,
    operationId: operationId || previous.operationId,
    ...(inputPreview ? { inputPreview } : {}),
  };
  if (type === "tool_execution_start") {
    next.startedAt = next.startedAt || observedAt;
    next.code = toolCode(details);
  }
  if (type === "tool_execution_update") {
    next.code = next.code || toolCode(details);
    next.partialResult = details.partialResult;
    next.outputPreview = toolPreview(details.outputPreview) ?? (isRecord(details.partialResult) ? toolPreview(details.partialResult.outputPreview) : undefined);
    if (details.partialResult !== undefined) next.output = exactPrintable(details.partialResult);
  }
  if (type === "tool_execution_end") {
    next.code = next.code || toolCode(details);
    next.result = exactPrintable(details.result);
    next.resultValue = details.result;
    next.outputPreview = toolPreview(details.outputPreview) ?? (isRecord(details.result) ? toolPreview(details.result.outputPreview) : undefined);
    next.isError = details.isError === true;
    next.unknown = unknownToolResult(details);
    next.endedAt = next.endedAt || observedAt;
    next.ended = true;
  }
  return new Map(toolRuns).set(key, next);
}

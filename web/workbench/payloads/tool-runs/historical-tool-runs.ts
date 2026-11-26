import type { ToolRun } from "./tool-run-types.ts";
import { isRecord } from "../is-record.ts";
import { safeText } from "../safe-text.ts";
import { emptyToolRun } from "./empty-tool-run.ts";
import { toolCode } from "./tool-code.ts";
import { exactPrintable } from "./exact-printable.ts";
import { unknownToolResult } from "./unknown-tool-result.ts";

const CALL_TYPES = ["toolCall", "tool_call", "tool-use"];

/** Tool runs rebuilt from persisted messages; message shapes vary by provider, so they are read defensively. */
export function historicalToolRuns(messages: unknown, sessionId: string | null): Map<string, ToolRun> {
  const runs = new Map<string, ToolRun>();
  if (!Array.isArray(messages)) return runs;
  const displaySessionId = sessionId || "session";
  for (const [messageIndex, message] of messages.entries()) {
    if (!isRecord(message)) continue;
    if (message.role === "assistant" && Array.isArray(message.content)) {
      for (const [partIndex, part] of message.content.entries()) {
        if (!isRecord(part) || typeof part.type !== "string" || !CALL_TYPES.includes(part.type)) continue;
        const id = safeText(part.id || part.toolCallId) || `historical-call-${messageIndex}-${partIndex}`;
        const key = `${displaySessionId}:${id}`;
        runs.set(key, emptyToolRun(key, displaySessionId, safeText(part.name || part.toolName) || "tool", "历史消息", toolCode(part)));
      }
    }
    if (message.role === "toolResult") {
      const id = safeText(message.toolCallId || message.id) || `historical-result-${messageIndex}`;
      const key = `${displaySessionId}:${id}`;
      const old = runs.get(key) || emptyToolRun(key, displaySessionId, safeText(message.toolName) || "tool", "历史消息");
      runs.set(key, {
        ...old,
        toolName: safeText(message.toolName) || old.toolName,
        result: exactPrintable(message),
        isError: message.isError === true,
        unknown: unknownToolResult(message),
        ended: true,
      });
    }
  }
  return runs;
}

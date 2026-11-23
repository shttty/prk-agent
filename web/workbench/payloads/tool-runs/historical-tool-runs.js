import { isRecord } from "../is-record.js";
import { safeText } from "../safe-text.js";
import { emptyToolRun } from "./empty-tool-run.js";
import { toolCode } from "./tool-code.js";
import { exactPrintable } from "./exact-printable.js";
import { unknownToolResult } from "./unknown-tool-result.js";
export function historicalToolRuns(messages, sessionId) {
  const runs = new Map();
  if (!Array.isArray(messages)) return runs;
  const displaySessionId = sessionId || "session";
  for (const [messageIndex, message] of messages.entries()) {
    if (!isRecord(message)) continue;
    if (message.role === "assistant" && Array.isArray(message.content)) {
      for (const [partIndex, part] of message.content.entries()) {
        if (!isRecord(part) || !["toolCall", "tool_call", "tool-use"].includes(part.type)) continue;
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


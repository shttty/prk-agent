import { isRecord } from "../../../workbench/payloads/is-record.js";
import { safeText } from "../../../workbench/payloads/safe-text.js";
import { toolId } from "./tool-id.js";
export function historicalRunMap(messages, sessionId) {
  const runs = new Map();
  for (const [messageIndex, message] of messages.entries()) {
    if (!isRecord(message)) continue;
    if (message.role === "assistant" && Array.isArray(message.content)) {
      for (const [partIndex, part] of message.content.entries()) {
        if (part.type !== "toolCall") continue;
        const id = toolId(part, `historical-call-${messageIndex}-${partIndex}`);
        runs.set(`${sessionId}:${id}`, { call: part, result: undefined });
      }
    }
    if (message.role === "toolResult") {
      const id = toolId(message, `historical-result-${messageIndex}`);
      const key = `${sessionId}:${id}`;
      const old = runs.get(key) || { call: { toolCallId: id, toolName: safeText(message.toolName) || safeText(message.name) || "tool" }, result: undefined };
      runs.set(key, { ...old, result: message });
    }
  }
  return runs;
}

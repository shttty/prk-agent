import { isPayload } from "../../payload/is-payload.ts";
import { safeText } from "../../../workbench/payloads/safe-text.js";
import type { ToolCall, ToolRecord } from "../conversation-types.ts";
import { toolId } from "./tool-id.ts";
export function historicalRunMap(messages: readonly unknown[], sessionId: string): Map<string, ToolRecord> {
  const runs = new Map<string, ToolRecord>();
  for (const [messageIndex, message] of messages.entries()) {
    if (!isPayload(message)) continue;
    if (message.role === "assistant" && Array.isArray(message.content)) {
      for (const [partIndex, part] of message.content.entries()) {
        if (!isPayload(part) || part.type !== "toolCall") continue;
        const call: ToolCall = part;
        const id = toolId(call, `historical-call-${messageIndex}-${partIndex}`);
        runs.set(`${sessionId}:${id}`, { call, result: undefined });
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

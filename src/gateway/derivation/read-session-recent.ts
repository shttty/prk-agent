import type { SessionHostSnapshot } from "../../sessions/host/host-types.ts";
import type { SessionObservation } from "../../plugins/sessions/session-types.ts";

export function readSessionRecent(messages: SessionHostSnapshot["messages"], limit: number): SessionObservation["recent"] {
  const recent: SessionObservation["recent"] = [];
  for (let index = messages.length - 1; index >= 0 && recent.length < limit; index--) {
    const message = messages[index];
    if (message?.role === "assistant") {
      for (let partIndex = message.content.length - 1; partIndex >= 0 && recent.length < limit; partIndex--) {
        const part = message.content[partIndex];
        if (part?.type === "text" && part.text.trim()) recent.push({ role: "assistant", text: part.text.slice(0, 600) });
        else if (part?.type === "toolCall") recent.push({ role: "assistant", toolName: part.name, text: `${part.name}(${JSON.stringify(part.arguments)})`.slice(0, 600) });
      }
    } else if (message?.role === "user" || message?.role === "toolResult") {
      const text = typeof message.content === "string" ? message.content : message.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
      if (message.role === "toolResult") recent.push({ role: "toolResult", text: text.slice(0, 600), toolName: message.toolName, isError: message.isError });
      else if (text.trim()) recent.push({ role: "user", text: text.slice(0, 600) });
    }
  }
  return recent.reverse();
}

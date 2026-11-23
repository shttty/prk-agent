import type { AgentSession } from "@earendil-works/pi-coding-agent";
import type { SessionOptions } from "../../../config/session/session-options.ts";
import type { AssistantFailure } from "./session-errors-types.ts";

export function latestAssistantFailure(session: Pick<AgentSession, "messages">, after: number, options: SessionOptions): AssistantFailure | undefined {
  const messages = session?.messages ?? [];
  for (let index = messages.length - 1; index >= Math.max(0, after, messages.length - options.errorLookbackMessages); index -= 1) {
    const message = messages[index];
    if (message.role === "assistant" && message.stopReason === "error") return message;
  }
  return undefined;
}

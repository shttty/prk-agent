import { useMemo } from "react";
import { contentText } from "../conversation/content-text.ts";
import { parsePeerMessages } from "../../../shared/session-messages/parse-peer-messages.ts";
export function usePromptHistory({ messages }: { messages: readonly unknown[] | undefined }) {
  const promptHistory = useMemo(() => (messages || []).flatMap((message) => isUserMessage(message) ? [contentText(message.content)] : []).filter((text) => text && !parsePeerMessages(text)), [messages]);
  return { promptHistory };
}

function isUserMessage(message: unknown): message is { role: "user"; content: unknown } {
  return typeof message === "object" && message !== null && "role" in message && message.role === "user" && "content" in message;
}

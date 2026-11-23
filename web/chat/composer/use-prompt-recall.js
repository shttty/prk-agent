import { useMemo } from "react";
import { contentText } from "../conversation/content-text.js";
import { parsePeerMessages } from "../../../shared/session-messages/parse-peer-messages.js";
export function usePromptHistory(ctx) {
  const { messages } = ctx;
  const promptHistory = useMemo(() => (messages || []).filter((message) => message.role === "user").map((message) => contentText(message.content)).filter((text) => text && !parsePeerMessages(text)), [messages]);
  return { promptHistory };
}

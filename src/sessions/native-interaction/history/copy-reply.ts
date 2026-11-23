import type { NativeActionRequest } from "../../../gateway/wire/wire-types.ts";
import type { NativeContext, NativeTarget } from "../native-types.ts";

export function copyReply(ctx: NativeContext, target: NativeTarget, request: NativeActionRequest, session: NativeTarget["session"]) {
  const messages = session?.messages ?? target.manager.buildSessionContext().messages;
  const last = messages.findLast((message) => message.role === "assistant");
  return { text: session?.getLastAssistantText() ?? (last?.role === "assistant" ? last.content.filter((part) => part.type === "text").map((part) => part.text).join("\n") : "") };
}

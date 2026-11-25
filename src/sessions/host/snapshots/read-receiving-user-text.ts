import type { AgentSession } from "@earendil-works/pi-coding-agent";

export function receivingUserText(session: AgentSession): string | null {
  const message = session.state.streamingMessage;
  if (message?.role !== "user") return null;
  return typeof message.content === "string" ? message.content
    : message.content.flatMap((part) => part.type === "text" ? [part.text] : []).join("");
}

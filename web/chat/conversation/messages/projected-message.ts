import type { ThreadMessage } from "@assistant-ui/react";
import type { TranscriptMessage } from "../conversation-types.ts";

/** assistant-ui carries exactly the message projectConversation gave it, but types it as its own ThreadMessage. */
export function projectedMessage(message: ThreadMessage): TranscriptMessage {
  return message as unknown as TranscriptMessage;
}

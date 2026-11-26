import type { MessagePart } from "../../conversation/conversation-types.ts";
export const hasText = (part: MessagePart | undefined) => part?.type === "text" && part.text.trim().length > 0;

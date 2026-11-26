import { isPayload } from "../../payload/is-payload.ts";
import type { Attachment, MessageCustom } from "../conversation-types.ts";

export function messageCustom(message: { content?: unknown }): MessageCustom {
  const images = Array.isArray(message.content) ? message.content.filter(isPayload).filter((part) => part.type === "image").slice(0, 4) : [];
  const attachments: Attachment[] = images.map((part, index) => ({ name: `图片 ${index + 1}`, type: typeof part.mimeType === "string" && part.mimeType ? part.mimeType : "image/png", data: typeof part.data === "string" ? part.data : undefined, source: "sdk" }));
  return attachments.length ? { attachments } : {};
}

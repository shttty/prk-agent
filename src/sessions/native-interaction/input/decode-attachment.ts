import { Buffer } from "node:buffer";
import type { ImageContent } from "@earendil-works/pi-ai";
import { WireError } from "../../../gateway/wire/create-error.ts";
import type { WireAttachment } from "../../../gateway/wire/wire-types.ts";
import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import { IMAGE_TYPES, TEXT_TYPES } from "../native-constants.ts";

export function decodeAttachment(attachment: WireAttachment, limits: LimitsOptions): { image?: ImageContent; text?: string } {
  const raw = Buffer.from(attachment.data, "base64");
  if (raw.byteLength !== attachment.size || raw.byteLength > limits.attachmentBytes) throw new WireError("INVALID_REQUEST", `Attachment ${JSON.stringify(attachment.name)} has an invalid decoded size.`);
  if ((IMAGE_TYPES as readonly string[]).includes(attachment.type)) return { image: { type: "image", data: attachment.data, mimeType: attachment.type } };
  if (!(TEXT_TYPES as readonly string[]).includes(attachment.type)) throw new WireError("INVALID_REQUEST", `Attachment type ${JSON.stringify(attachment.type)} is not supported.`);
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(raw); }
  catch { throw new WireError("INVALID_REQUEST", `Attachment ${JSON.stringify(attachment.name)} is not valid UTF-8 text.`); }
  return { text };
}

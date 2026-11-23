import { Buffer } from "node:buffer";
import type { ImageContent } from "@earendil-works/pi-ai";
import { WireError } from "../../../gateway/wire/create-error.ts";
import type { ExtendedSendRequest } from "../../../gateway/wire/wire-types.ts";
import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import type { ReferencesOptions } from "../../../config/references/references-options.ts";
import type { NativeTarget } from "../native-types.ts";
import { TEXT_TYPES } from "../native-constants.ts";
import { pathReference } from "../references/path-reference.ts";
import { decodeAttachment } from "./decode-attachment.ts";

export async function prepareInput(target: NativeTarget, request: ExtendedSendRequest, limits: LimitsOptions, referencesOptions: ReferencesOptions): Promise<{ message: string; images: ImageContent[] }> {
  const images: ImageContent[] = [];
  let total = 0;
  const textParts: string[] = [];
  for (const attachment of request.attachments ?? []) {
    total += attachment.size;
    if (total > limits.attachmentTotalBytes) throw new WireError("INVALID_REQUEST", `Decoded attachment bytes exceed the ${limits.attachmentTotalBytes} byte total limit.`);
    const decoded = decodeAttachment(attachment, limits);
    if (decoded.image) images.push(decoded.image);
    if (decoded.text !== undefined) textParts.push(`[attachment name=${JSON.stringify(attachment.name)} bytes=${attachment.size}]\n${decoded.text}\n[/attachment]`);
  }
  for (const reference of request.references ?? []) {
    if (reference.type === "target-file") {
      const path = pathReference(reference, target);
      if (!target.readReference) throw new WireError("INVALID_REQUEST", "Target-file reference content is unavailable for this exact target session.");
      const loaded = await target.readReference(path);
      if (loaded.path !== path || !(TEXT_TYPES as readonly string[]).includes(loaded.type) || Buffer.byteLength(loaded.content, "utf8") > referencesOptions.maxBytes) throw new WireError("INVALID_REQUEST", "Target-file reference must resolve to bounded text content at send time.");
      total += Buffer.byteLength(loaded.content, "utf8");
      textParts.push(`[target-file target=${JSON.stringify(target.target)} session=${JSON.stringify(target.sessionId)} path=${JSON.stringify(path)}]\n${loaded.content}\n[/target-file]`);
    } else if (reference.type === "text" && reference.source === "user" && reference.text !== undefined) {
      const bytes = Buffer.byteLength(reference.text, "utf8");
      total += bytes;
      textParts.push(`[reference-text name=${JSON.stringify(reference.name ?? "reference")} bytes=${bytes}]\n${reference.text}\n[/reference-text]`);
    } else throw new WireError("INVALID_REQUEST", "References must be user text or an exact execution-target text file; browser binary content belongs in attachments.");
    if (total > limits.inputBytes) throw new WireError("INVALID_REQUEST", `Combined attachment and reference content exceeds the ${limits.inputBytes} byte input bound.`);
  }
  const message = [request.message, ...textParts].filter((part) => part.length > 0).join("\n\n");
  const augmentedBytes = Buffer.byteLength(message, "utf8");
  if (augmentedBytes > limits.augmentedMessageBytes) throw new WireError("INVALID_REQUEST", `Augmented message content exceeds the ${limits.augmentedMessageBytes} byte native input bound.`);
  if (augmentedBytes + total > limits.inputBytes) throw new WireError("INVALID_REQUEST", `Combined framed message content exceeds the ${limits.inputBytes} byte Gateway input limit.`);
  return { message, images };
}

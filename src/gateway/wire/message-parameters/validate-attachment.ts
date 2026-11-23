import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import type { WireAttachment } from "../wire-types.ts";
import { object } from "../is-record.ts";
import { keys } from "../fields/has-only-fields.ts";
import { fieldText } from "../fields/is-field-text.ts";
import { NATIVE_ATTACHMENT_MIME_TYPES } from "../attachment-constants.ts";
import { validBase64 } from "./valid-base64.ts";

export function validAttachment(value: unknown, limits: LimitsOptions): value is WireAttachment {
  if (!object(value) || !keys(value, ["name", "type", "size", "data", "source"]) || (value.source !== undefined && value.source !== "browser") || !fieldText(value.name, limits.attachmentNameChars)
    || typeof value.type !== "string" || value.type.length > limits.mimeTypeChars || /\p{Cc}/u.test(value.type)
    || typeof value.size !== "number" || !Number.isSafeInteger(value.size) || value.size < 0 || value.size > limits.attachmentBytes || !validBase64(value.data, limits)) return false;
  if (!(NATIVE_ATTACHMENT_MIME_TYPES as readonly string[]).includes(value.type)) return false;
  const decoded = Math.floor((value.data.length * 3) / 4) - (value.data.endsWith("==") ? 2 : value.data.endsWith("=") ? 1 : 0);
  return decoded === value.size;
}

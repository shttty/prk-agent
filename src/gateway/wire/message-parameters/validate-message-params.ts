import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import { object } from "../is-record.ts";
import { keys } from "../fields/has-only-fields.ts";
import { text } from "../fields/is-text.ts";
import { routingIdentifier } from "../fields/is-routing-identifier.ts";
import { invalid } from "../method-parameters/reject-invalid-request.ts";
import { validAttachment } from "./validate-attachment.ts";
import { validReference } from "./validate-reference.ts";

export function validateMessageParams(p: Record<string, unknown>, limits: LimitsOptions): void {
  if (!keys(p, ["sessionId", "requestId", "message", "queue", "mode", "source", "attachments", "references"]) || !routingIdentifier(p.sessionId, limits)
    || !text(p.requestId, limits.requestIdChars) || typeof p.message !== "string" || p.message.length > limits.messageChars
    || (!p.message.trim() && !(Array.isArray(p.attachments) && p.attachments.length))
    || (p.queue !== undefined && p.queue !== "steer" && p.queue !== "followUp")
    || (p.mode !== undefined && p.mode !== "auto" && p.mode !== "plain")
    || (p.source !== undefined && p.source !== "web")
    || (p.attachments !== undefined && (!Array.isArray(p.attachments) || p.attachments.length > limits.attachmentsMax
      || p.attachments.some((attachment: unknown) => !validAttachment(attachment, limits))
      || p.attachments.reduce((total: number, attachment: unknown) => total + (object(attachment) && typeof attachment.size === "number" ? attachment.size : limits.attachmentTotalBytes), 0) > limits.attachmentTotalBytes))
    || (p.references !== undefined && (!Array.isArray(p.references) || p.references.length > limits.referencesMax || p.references.some((reference: unknown) => !validReference(reference, limits))))
    || (Array.isArray(p.attachments) && new TextEncoder().encode(p.message as string).byteLength + p.attachments.reduce((total: number, attachment: unknown) => total + (object(attachment) && typeof attachment.data === "string" ? attachment.data.length : limits.inputBytes), 0) > limits.inputBytes)) return invalid();
}

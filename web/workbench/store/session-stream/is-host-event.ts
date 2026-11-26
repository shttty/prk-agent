import type { SessionHostEvent } from "../../../../src/gateway/wire/web-types.ts";
import { isRecord } from "../../payloads/is-record.ts";

/** A host event frame: the fields the ordering rules read are checked; the rest is the Gateway's as sent. */
export function isHostEvent(value: unknown): value is SessionHostEvent {
  return isRecord(value) && typeof value.type === "string" && typeof value.streamId === "string" && Boolean(value.streamId)
    && typeof value.sequence === "number" && Number.isSafeInteger(value.sequence);
}

import { isPayload } from "../../payload/is-payload.ts";
import type { MemoryNoticeDetails } from "../../memory-notice/MemoryNotice.tsx";

/** A `memory-notice` custom message's details, as the Gateway writes them. */
export function isMemoryNotice(value: unknown): value is MemoryNoticeDetails {
  return isPayload(value) && typeof value.source === "string" && Array.isArray(value.changes);
}

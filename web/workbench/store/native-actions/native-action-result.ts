import type { NativeActionReply } from "../store-types.ts";
import { isRecord } from "../../payloads/is-record.ts";

const STATUSES = ["running", "completed", "failed", "cancelled", "unavailable", "unknown"];

export function nativeActionResult(value: unknown): value is NativeActionReply {
  return isRecord(value) && typeof value.requestId === "string" && typeof value.action === "string"
    && typeof value.status === "string" && STATUSES.includes(value.status);
}

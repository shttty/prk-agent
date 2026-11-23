import { isRecord } from "../../payloads/is-record.js";
export function nativeActionResult(ctx, value) {
    return isRecord(value) && typeof value.requestId === "string" && typeof value.action === "string"
      && typeof value.status === "string" && value.status.length > 0;
  }


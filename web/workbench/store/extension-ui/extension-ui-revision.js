import { isRecord } from "../../payloads/is-record.js";
export function extensionUiRevision(ctx, value) {
    return isRecord(value) && Number.isSafeInteger(value.revision) ? value.revision : null;
  }


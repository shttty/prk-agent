import { isRecord } from "../../payloads/is-record.ts";

export function extensionUiRevision(value: unknown): number | null {
  return isRecord(value) && typeof value.revision === "number" && Number.isSafeInteger(value.revision) ? value.revision : null;
}

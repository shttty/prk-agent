import { isRecord } from "./is-record.ts";

/** Whether a session POST answered `{ ok: true }`, the Gateway's confirmation of a change with no row to return. */
export function isOkReply(value: unknown): boolean {
  return isRecord(value) && value.ok === true;
}

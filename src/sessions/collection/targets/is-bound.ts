import type { SessionRecord } from "../collection-types.ts";

export function sessionBound(record: SessionRecord): boolean {
  return record.state !== "closed";
}

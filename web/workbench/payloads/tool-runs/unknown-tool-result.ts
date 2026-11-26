import { isRecord } from "../is-record.ts";

export function unknownToolResult(details: unknown): boolean {
  const result = isRecord(details) && details.result ? details.result : details;
  return isRecord(result) && isRecord(result.details) && result.details.outcome === "unknown";
}

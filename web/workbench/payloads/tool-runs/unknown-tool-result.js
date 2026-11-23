import { isRecord } from "../is-record.js";
export function unknownToolResult(details) {
  const result = details?.result || details;
  return isRecord(result) && isRecord(result.details) && result.details.outcome === "unknown";
}


import { safeText } from "../../../workbench/payloads/safe-text.js";
import type { ToolRecord } from "../conversation-types.ts";
export function startedAtValue(record: ToolRecord) {
  const value = Date.parse(safeText(record.run?.startedAt));
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

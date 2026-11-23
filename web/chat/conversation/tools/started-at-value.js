import { safeText } from "../../../workbench/payloads/safe-text.js";
export function startedAtValue(record) {
  const value = Date.parse(safeText(record?.run?.startedAt));
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

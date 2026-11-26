import { safeText } from "../../../workbench/payloads/safe-text.js";
// A given fallback (the message index) is used as is, 0 included: projecting the same history twice must yield equal messages.
export function dateValue(value: unknown, fallback?: number): Date {
  const parsed = value instanceof Date ? value.getTime() : Date.parse(safeText(value));
  return Number.isFinite(parsed) ? new Date(parsed) : new Date(fallback ?? Date.now());
}

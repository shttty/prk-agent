import { isRecord } from "../../../workbench/payloads/is-record.js";
import { contentText } from "../content-text.js";
export function exactPrintable(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (isRecord(value) && (typeof value.text === "string" || value.content !== undefined)) {
    const text = contentText(value);
    const hasText = typeof value.text === "string" || typeof value.content === "string"
      || (Array.isArray(value.content) && value.content.every((part) => isRecord(part) && typeof part.text === "string"));
    if (text || hasText) return text;
  }
  try { return JSON.stringify(value, null, 2) || ""; } catch { return "[结果无法显示]"; }
}

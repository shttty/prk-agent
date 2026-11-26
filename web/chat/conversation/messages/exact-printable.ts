import { isPayload } from "../../payload/is-payload.ts";
import { contentText } from "../content-text.ts";
export function exactPrintable(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (isPayload(value) && (typeof value.text === "string" || value.content !== undefined)) {
    const text = contentText(value);
    const hasText = typeof value.text === "string" || typeof value.content === "string"
      || (Array.isArray(value.content) && value.content.every((part) => isPayload(part) && typeof part.text === "string"));
    if (text || hasText) return text;
  }
  try { return JSON.stringify(value, null, 2) || ""; } catch { return "[结果无法显示]"; }
}

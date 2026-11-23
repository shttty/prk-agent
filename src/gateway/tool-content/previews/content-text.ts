import { object } from "../../wire/is-record.ts";

// Match the Web's contentText/exactPrintable display, without its display-only truncation.
export function contentText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(contentText).filter(Boolean).join("\n");
  if (object(value)) {
    if (object(value.details) && typeof value.details.rawOutput === "string") return value.details.rawOutput;
    if (typeof value.text === "string") return value.text;
    if (value.content !== undefined) return contentText(value.content);
  }
  return "";
}

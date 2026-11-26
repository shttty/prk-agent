import { isRecord } from "./is-record.ts";

export function contentText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(contentText).filter(Boolean).join("\n");
  if (isRecord(value)) {
    if (isRecord(value.details) && typeof value.details.rawOutput === "string") return value.details.rawOutput;
    if (typeof value.text === "string") return value.text;
    if (value.content !== undefined) return contentText(value.content);
  }
  return "";
}

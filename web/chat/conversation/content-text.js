import { isRecord } from "../../workbench/payloads/is-record.js";
export function contentText(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(contentText).filter(Boolean).join("\n");
  if (isRecord(value)) {
    if (typeof value.text === "string") return value.text;
    if (value.content !== undefined) return contentText(value.content);
  }
  return "";
}

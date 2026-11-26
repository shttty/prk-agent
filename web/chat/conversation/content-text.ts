import { isPayload } from "../payload/is-payload.ts";
export function contentText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(contentText).filter(Boolean).join("\n");
  if (isPayload(value)) {
    if (typeof value.text === "string") return value.text;
    if (value.content !== undefined) return contentText(value.content);
  }
  return "";
}

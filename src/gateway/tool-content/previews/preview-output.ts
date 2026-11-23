import { object } from "../../wire/is-record.ts";
import { contentText } from "./content-text.ts";

export function outputText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (object(value) && (typeof value.text === "string" || value.content !== undefined)) {
    const text = contentText(value);
    const hasText = typeof value.text === "string" || typeof value.content === "string"
      || (Array.isArray(value.content) && value.content.every((part) => object(part) && typeof part.text === "string"));
    if (text || hasText) return text;
  }
  return JSON.stringify(value, null, 2) || "";
}

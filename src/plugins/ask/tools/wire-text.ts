import { record } from "./answer-record.ts";
/** A free-text field is exactly `{text}` and not blank. Anything else (an attachment, say) is refused, not dropped: answers carry text only. */
export function wireText(value: unknown): { text: string } | { error: string } {
  if (!record(value) || typeof value.text !== "string" || Object.keys(value).some((key) => key !== "text")) return { error: "Text field is invalid." };
  const text = value.text.trim();
  return text ? { text } : { error: "Text field is empty." };
}

import { asText } from "./as-text.ts";
/** Split `text` into display rows; a final newline is not an extra empty row (`trailing` remembers it). */
export function splitRows(text: unknown): { rows: string[]; trailing: boolean } {
  const rows = asText(text).split("\n");
  const trailing = rows.length > 1 && rows.at(-1) === "";
  if (trailing) rows.pop();
  return { rows, trailing };
}

import { contentText } from "./content-text.ts";
import { trimDisplay } from "./printable/trim-display.ts";
import { redacted } from "./printable/redacted.ts";

export function printable(value: unknown): string {
  if (value === undefined || value === null) return "";
  const text = contentText(value);
  if (text) return text;
  if (typeof value === "string") return value;
  try { return trimDisplay(JSON.stringify(redacted(value), null, 2)); } catch { return "[结果无法显示]"; }
}

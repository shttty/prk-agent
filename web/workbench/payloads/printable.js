import { contentText } from "./content-text.js";
import { trimDisplay } from "./printable/trim-display.js";
import { redacted } from "./printable/redacted.js";
export function printable(value) {
  if (value === undefined || value === null) return "";
  const text = contentText(value);
  if (text) return text;
  if (typeof value === "string") return value;
  try { return trimDisplay(JSON.stringify(redacted(value), null, 2)); } catch { return "[结果无法显示]"; }
}


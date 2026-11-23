import { safeText } from "../../../workbench/payloads/safe-text.js";
export const MAX_DISPLAY_CHARS = 18_000;

export function trimDisplay(value) {
  const text = safeText(value);
  return text.length > MAX_DISPLAY_CHARS ? `${text.slice(0, MAX_DISPLAY_CHARS)}\n…输出已截断` : text;
}

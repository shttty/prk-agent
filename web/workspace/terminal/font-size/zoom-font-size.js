import { TERMINAL_FONT_SIZE } from "../terminal-constants.js";

/** The size after a zoom key: one px bigger / smaller within the bounds, or back to the default. */
export function zoomFontSize(size, action) {
  const { initial, min, max } = TERMINAL_FONT_SIZE;
  if (action === "zoomReset") return initial;
  return Math.min(max, Math.max(min, size + (action === "zoomIn" ? 1 : -1)));
}

import type { TerminalAction } from "../terminal-types.ts";

const CLIPBOARD: Record<string, TerminalAction> = { KeyC: "copy", KeyV: "paste", KeyA: "selectAll", KeyF: "find" };
const ZOOM: Record<string, TerminalAction> = { "+": "zoomIn", "=": "zoomIn", "-": "zoomOut", "0": "zoomReset" };

/** The terminal's own keys, anything else → null (goes to the PTY). Konsole's Ctrl+Shift+C / V / A / F by physical key
 * (copy, paste, select all, find); Ctrl/⌘ + `+` `-` `0` by the character typed (font size bigger, smaller, default). */
export function terminalShortcut(event: KeyboardEvent): TerminalAction | null {
  if (event.altKey) return null;
  if (event.ctrlKey && event.shiftKey && !event.metaKey && CLIPBOARD[event.code]) return CLIPBOARD[event.code] ?? null;
  if (event.ctrlKey !== event.metaKey) return ZOOM[event.key] ?? null;
  return null;
}

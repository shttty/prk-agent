const CLIPBOARD = { KeyC: "copy", KeyV: "paste", KeyA: "selectAll", KeyF: "find" };
const ZOOM = { "+": "zoomIn", "=": "zoomIn", "-": "zoomOut", "0": "zoomReset" };

/** The terminal's own keys, anything else → null (goes to the PTY). Konsole's Ctrl+Shift+C / V / A / F by physical key
 * (copy, paste, select all, find); Ctrl/⌘ + `+` `-` `0` by the character typed (font size bigger, smaller, default). */
export function terminalShortcut(event) {
  if (event.altKey) return null;
  if (event.ctrlKey && event.shiftKey && !event.metaKey && CLIPBOARD[event.code]) return CLIPBOARD[event.code];
  if (event.ctrlKey !== event.metaKey) return ZOOM[event.key] ?? null;
  return null;
}

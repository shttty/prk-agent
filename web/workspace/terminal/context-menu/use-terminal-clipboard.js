import { useCallback } from "react";
import { useEffect } from "react";
import { useState } from "react";
import { opensMenu } from "./opens-menu.js";
import { runTerminalAction } from "./run-terminal-action.js";

/** PRK's own right-click menu and the clipboard actions for the xterm in `term`, mounted in `host` (the keys that run
 * them: use-terminal-session). */
export function useTerminalClipboard(term, host) {
  const [menu, setMenu] = useState(null);
  const [error, setError] = useState("");
  const act = useCallback((action) => {
    const terminal = term.current;
    if (terminal) runTerminalAction(action, terminal).then(() => setError(""), (reason) => setError(reason.message));
  }, [term]);
  // Capture phase on the host, before xterm's own listener: the browser menu never shows inside the terminal.
  useEffect(() => {
    const element = host.current;
    if (!element) return undefined;
    const onContextMenu = (event) => {
      event.preventDefault();
      const terminal = term.current;
      if (!terminal || !opensMenu(terminal.modes.mouseTrackingMode, event.shiftKey)) return;
      // The anchor sits in the terminal view (.pi-term-view), not at fixed viewport coordinates: a dock region may be
      // a containing block for fixed elements.
      const view = element.parentElement.getBoundingClientRect();
      setMenu({ x: event.clientX - view.left, y: event.clientY - view.top, selection: terminal.hasSelection() });
    };
    element.addEventListener("contextmenu", onContextMenu, true);
    return () => element.removeEventListener("contextmenu", onContextMenu, true);
  }, [term, host]);
  return { menu, closeMenu: () => setMenu(null), act, error, clearError: () => setError("") };
}

import { useCallback } from "react";
import { useEffect } from "react";
import { useState } from "react";
import type { RefObject } from "react";
import type { Terminal } from "@xterm/xterm";
import type { TerminalAction, TerminalMenuState } from "../terminal-types.ts";
import { opensMenu } from "./opens-menu.ts";
import { runTerminalAction } from "./run-terminal-action.ts";

/** PRK's own right-click menu and the clipboard actions for the xterm in `term`, mounted in `host` (the keys that run
 * them: use-terminal-session). */
export function useTerminalClipboard(term: RefObject<Terminal | null>, host: RefObject<HTMLDivElement | null>) {
  const [menu, setMenu] = useState<TerminalMenuState | null>(null);
  const [error, setError] = useState("");
  const act = useCallback((action: TerminalAction) => {
    const terminal = term.current;
    if (terminal) runTerminalAction(action, terminal).then(() => setError(""), (reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, [term]);
  // Capture phase on the host, before xterm's own listener: the browser menu never shows inside the terminal.
  useEffect(() => {
    const element = host.current;
    if (!element) return undefined;
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      const terminal = term.current;
      if (!terminal || !opensMenu(terminal.modes.mouseTrackingMode, event.shiftKey)) return;
      // The anchor sits in the terminal view (.pi-term-view), not at fixed viewport coordinates: a dock region may be
      // a containing block for fixed elements.
      const view = element.parentElement?.getBoundingClientRect();
      if (!view) return;
      setMenu({ x: event.clientX - view.left, y: event.clientY - view.top, selection: terminal.hasSelection() });
    };
    element.addEventListener("contextmenu", onContextMenu, true);
    return () => element.removeEventListener("contextmenu", onContextMenu, true);
  }, [term, host]);
  return { menu, closeMenu: () => setMenu(null), act, error, clearError: () => setError("") };
}

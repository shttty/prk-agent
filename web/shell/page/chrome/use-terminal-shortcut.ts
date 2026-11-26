import { useEffect } from "react";
import { toggleWorkspace } from "./toggle-workspace.ts";

/** Ctrl/Cmd+J or Ctrl/Cmd+` toggles the workspace (its terminal tabs, files and diffs). */
export function useTerminalShortcut({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && (event.key.toLowerCase() === "j" || event.key === "`")) {
        event.preventDefault();
        event.stopPropagation();
        toggleWorkspace();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enabled]);
}

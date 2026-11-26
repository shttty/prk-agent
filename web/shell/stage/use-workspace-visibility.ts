import type { Engine } from "../../workspace/editor-dock/engine/engine-types.ts";
import { useEffect } from "react";
import { useRef } from "react";
import { layout } from "../layout/layout-store.ts";

type WorkspaceVisibility = { engine: Engine | null; hidden: boolean; hasTabs: boolean; treeOpen: boolean; terminalPending: boolean };

/** The open workspace never stays empty. Opened with nothing in it and no terminal to open (a session without one) it
 * opens the directory so a file can be picked; once it is empty and the directory is closed it closes itself. A session
 * with a terminal is not empty for long: the terminal sync opens a shell once the server's list is read
 * (`terminalPending`), so nothing is decided until then. */
export function useWorkspaceVisibility({ engine, hidden, hasTabs, treeOpen, terminalPending }: WorkspaceVisibility) {
  const wasHidden = useRef(true);
  useEffect(() => {
    if (!engine) return;
    if (hidden) { wasHidden.current = true; return; }
    const opening = wasHidden.current;
    wasHidden.current = false;
    if (engine.count() > 0 || terminalPending || treeOpen) return;
    layout.set(opening ? { treeOpen: true } : { workspaceOpen: false });
  }, [engine, hidden, hasTabs, treeOpen, terminalPending]);
}

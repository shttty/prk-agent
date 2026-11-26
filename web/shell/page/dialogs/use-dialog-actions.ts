import { useMemo } from "react";
import type { PageActions } from "../page-types.ts";
type DialogActionsOptions = { actions: PageActions; store: { getSnapshot: () => { selectedSessionId: string | null } }; dialogSessionId: string | null | undefined };

const SCOPED = ["renameSession", "assignProject", "manageSession", "archiveSession", "recoverSession"] as const;

export function useDialogActions({ actions, store, dialogSessionId }: DialogActionsOptions) {
  const dialogActions = useMemo(() => {
    const scoped = { ...actions };
    for (const name of SCOPED) {
      scoped[name] = (...args: unknown[]) => {
        const current = store.getSnapshot();
        if (!dialogSessionId || current.selectedSessionId !== dialogSessionId) return false;
        return (actions[name] as (...input: unknown[]) => unknown)(...args);
      };
    }
    return scoped;
  }, [actions, store, dialogSessionId]);
  return { dialogActions };
}
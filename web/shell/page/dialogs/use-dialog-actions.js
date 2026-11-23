import { useMemo } from "react";
export function useDialogActions({ actions, store, dialogSessionId }) {
  const dialogActions = useMemo(() => {
    const scoped = { ...actions };
    for (const name of ["renameSession", "assignProject", "manageSession", "archiveSession", "recoverSession"]) {
      scoped[name] = (...args) => {
        const current = store.getSnapshot();
        if (!dialogSessionId || current.selectedSessionId !== dialogSessionId) return false;
        return actions[name](...args);
      };
    }
    return scoped;
  }, [actions, store, dialogSessionId]);
  return { dialogActions };
}
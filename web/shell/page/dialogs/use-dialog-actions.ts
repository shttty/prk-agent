import { useMemo } from "react";
import type { PageActions } from "../page-types.ts";
import { scopedAction } from "./scoped-action.ts";

type DialogActionsOptions = { actions: PageActions; store: { getSnapshot: () => { selectedSessionId: string | null } }; dialogSessionId: string | null | undefined };

/** The actions a session dialog calls: each refuses (resolves false) once the selection has moved off the session the dialog was opened for. */
export function useDialogActions({ actions, store, dialogSessionId }: DialogActionsOptions) {
  const dialogActions = useMemo(() => {
    const inDialogSession = () => Boolean(dialogSessionId) && store.getSnapshot().selectedSessionId === dialogSessionId;
    return {
      ...actions,
      renameSession: scopedAction(actions.renameSession, inDialogSession),
      assignProject: scopedAction(actions.assignProject, inDialogSession),
      manageSession: scopedAction(actions.manageSession, inDialogSession),
      archiveSession: scopedAction(actions.archiveSession, inDialogSession),
      recoverSession: scopedAction(actions.recoverSession, inDialogSession),
    };
  }, [actions, store, dialogSessionId]);
  return { dialogActions };
}

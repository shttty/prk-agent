import { useMemo } from "react";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { isBusy } from "../conversation/is-busy.js";
/**
 * The PresentationContext value: only the fields transcript components read, each subscribed on its own. A stream
 * delta changes none of them, so it does not re-render finalized messages through the context.
 */
export function usePresentationValue({ actions, preserveDisclosure }) {
  const sessionId = useWorkbench((state) => state.selectedSessionId);
  const openedTools = useWorkbench((state) => state.presentation?.openedTools);
  const showImages = useWorkbench((state) => state.showImages);
  const streamId = useWorkbench((state) => state.session.streamId);
  const presentationRevision = useWorkbench((state) => state.session.presentationRevision);
  const extensionUiRender = useWorkbench((state) => state.session.extensionUiRender);
  const connection = useWorkbench((state) => state.session.connection);
  const hostState = useWorkbench((state) => state.session.snapshot?.state);
  const nativePending = useWorkbench((state) => state.session.pending.has("nativeActionPending"));
  const busy = useWorkbench(isBusy);
  return useMemo(() => ({ actions, preserveDisclosure, sessionId, openedTools, showImages, streamId, presentationRevision, extensionUiRender, connection, hostState, nativePending, busy }),
    [actions, preserveDisclosure, sessionId, openedTools, showImages, streamId, presentationRevision, extensionUiRender, connection, hostState, nativePending, busy]);
}

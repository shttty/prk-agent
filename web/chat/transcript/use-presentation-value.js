import { useMemo } from "react";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
/**
 * The PresentationContext value: only the fields transcript components read, each subscribed on its own. A stream
 * delta changes none of them, so it does not re-render finalized messages through the context.
 */
export function usePresentationValue({ actions, preserveDisclosure, revealKernelCell }) {
  const sessionId = useWorkbench((state) => state.selectedSessionId);
  const openedTools = useWorkbench((state) => state.presentation?.openedTools);
  const showImages = useWorkbench((state) => state.showImages);
  const streamId = useWorkbench((state) => state.session.streamId);
  const presentationRevision = useWorkbench((state) => state.session.presentationRevision);
  const extensionUiRender = useWorkbench((state) => state.session.extensionUiRender);
  return useMemo(() => ({ actions, preserveDisclosure, revealKernelCell, sessionId, openedTools, showImages, streamId, presentationRevision, extensionUiRender }),
    [actions, preserveDisclosure, revealKernelCell, sessionId, openedTools, showImages, streamId, presentationRevision, extensionUiRender]);
}

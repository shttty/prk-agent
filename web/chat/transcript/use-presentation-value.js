import { useMemo } from "react";
import { useTranscriptEffects } from "./use-transcript-effects.js";
import { useTurnFoldMode } from "./turns/use-turn-fold-mode.js";
import { findSessionRow } from "../../workbench/payloads/find-session-row.js";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
/**
 * The PresentationContext value: only the fields transcript components read, each subscribed on its own. A stream
 * delta changes none of them, so it does not re-render finalized messages through the context.
 */
export function usePresentationValue({ actions, preserveDisclosure, revealKernelCell }) {
  const [turnFoldMode] = useTurnFoldMode();
  const { showThinking: [showThinking], expandTools: [autoExpandTools], expandThinking: [expandThinking], streamOutput: [streamOutput] } = useTranscriptEffects();
  const transcriptDisplay = useMemo(() => ({ turnFoldMode, showThinking, streamOutput }), [turnFoldMode, showThinking, streamOutput]);
  const sessionId = useWorkbench((state) => state.selectedSessionId);
  const target = useWorkbench((state) => findSessionRow(state, state.selectedSessionId)?.target);
  const openedTools = useWorkbench((state) => state.presentation?.openedTools);
  const showImages = useWorkbench((state) => state.showImages);
  const streamId = useWorkbench((state) => state.session.streamId);
  const presentationRevision = useWorkbench((state) => state.session.presentationRevision);
  const extensionUiRender = useWorkbench((state) => state.session.extensionUiRender);
  const expandTools = autoExpandTools || extensionUiRender?.toolsExpanded === true;
  return useMemo(() => ({ actions, preserveDisclosure, revealKernelCell, sessionId, target, openedTools, showImages, streamId, presentationRevision, extensionUiRender, transcriptDisplay, expandTools, expandThinking }),
    [actions, preserveDisclosure, revealKernelCell, sessionId, target, openedTools, showImages, streamId, presentationRevision, extensionUiRender, transcriptDisplay, expandTools, expandThinking]);
}

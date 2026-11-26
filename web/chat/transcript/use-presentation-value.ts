import { useMemo } from "react";
import type { PresentationValue } from "./presentation-types.ts";
import { createKernelImageLoader } from "./tool-calls/kernel-cell/create-kernel-image-loader.ts";
import { useTranscriptEffects } from "./use-transcript-effects.ts";
import { useTurnFoldMode } from "./turns/use-turn-fold-mode.ts";
import { findSessionRow } from "../../workbench/payloads/find-session-row.js";
import { useChatState } from "../thread/use-chat-state.ts";
/**
 * The PresentationContext value: only the fields transcript components read, each subscribed on its own. A stream
 * delta changes none of them, so it does not re-render finalized messages through the context.
 */
type PresentationInputs = Pick<PresentationValue, "actions" | "preserveDisclosure" | "revealKernelCell">;

export function usePresentationValue({ actions, preserveDisclosure, revealKernelCell }: PresentationInputs): PresentationValue {
  const [turnFoldMode] = useTurnFoldMode();
  const { showThinking: [showThinking], expandTools: [autoExpandTools], expandThinking: [expandThinking], streamOutput: [streamOutput] } = useTranscriptEffects();
  const sessionId = useChatState((state) => state.selectedSessionId);
  const target = useChatState((state) => findSessionRow(state, state.selectedSessionId)?.target);
  const openedTools = useChatState((state) => state.presentation?.openedTools);
  const showImages = useChatState((state) => state.showImages);
  const transcriptDisplay = useMemo(() => ({ turnFoldMode, showThinking, streamOutput, showImages }), [turnFoldMode, showThinking, streamOutput, showImages]);
  const streamId = useChatState((state) => state.session.streamId);
  const loadKernelImage = useMemo(() => streamId && sessionId ? createKernelImageLoader(actions.api) : null, [actions.api, streamId, sessionId]);
  const presentationRevision = useChatState((state) => state.session.presentationRevision);
  const extensionUiRender = useChatState((state) => state.session.extensionUiRender);
  const expandTools = autoExpandTools || extensionUiRender?.toolsExpanded === true;
  return useMemo(() => ({ actions, preserveDisclosure, revealKernelCell, sessionId, target, openedTools, showImages, streamId, loadKernelImage, presentationRevision, extensionUiRender, transcriptDisplay, expandTools, expandThinking }),
    [actions, preserveDisclosure, revealKernelCell, sessionId, target, openedTools, showImages, streamId, loadKernelImage, presentationRevision, extensionUiRender, transcriptDisplay, expandTools, expandThinking]);
}

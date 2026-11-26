import type { KernelEvent, MessageStatus } from "../conversation/conversation-types.ts";
import type { ChatActions } from "../thread/chat-actions-types.ts";
import type { ExtensionRender } from "../../workbench/store/extension-ui/extension-render-types.ts";
import type { KernelImageLoader } from "./tool-calls/kernel-cell/kernel-image-types.ts";

export type TurnFoldMode = "segmented" | "whole";
export type TranscriptDisplay = { turnFoldMode: TurnFoldMode; showThinking: boolean; streamOutput: boolean; showImages: boolean };

/** What transcript components read from the workbench through PresentationContext. */
export type PresentationValue = {
  actions: ChatActions;
  preserveDisclosure: (node: Element | null) => void;
  revealKernelCell: (event: { preventDefault: () => void }, cell: KernelEvent) => void;
  sessionId: string | null;
  target?: string;
  openedTools?: string[];
  showImages?: boolean;
  streamId: string | null;
  loadKernelImage: KernelImageLoader | null;
  presentationRevision: number;
  extensionUiRender?: ExtensionRender | null;
  transcriptDisplay: TranscriptDisplay;
  expandTools: boolean;
  expandThinking: boolean;
};

export type { MessageStatus };

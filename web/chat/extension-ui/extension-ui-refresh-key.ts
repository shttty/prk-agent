import type { ChatState } from "../thread/chat-state-types.ts";

export function extensionUiRefreshKey(state: ChatState) {
  return `${state.session.extensionUi?.revision || 0}:${state.session.transcriptRevision || 0}:${state.session.presentationRevision || 0}:${state.session.snapshot?.sequence || 0}:${state.session.snapshot?.operation?.operationId || ""}`;
}


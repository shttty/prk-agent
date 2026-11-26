import type { ChatState } from "../thread/chat-state-types.ts";
import { extensionUiRefreshKey } from "./extension-ui-refresh-key.ts";
export function extensionUiRenderTriggerKey(state: ChatState, geometry: { width: number; height: number }) {
  return [state.session.streamId, extensionUiRefreshKey(state), state.session.historyPageRevision, geometry.width, geometry.height, state.selectedSessionId, state.session.snapshot?.sessionId, state.session.connection, state.extensionUiRenderIntervalMs].join("|");
}


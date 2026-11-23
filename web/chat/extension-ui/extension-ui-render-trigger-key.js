import { extensionUiRefreshKey } from "./extension-ui-refresh-key.js";
export function extensionUiRenderTriggerKey(state, geometry) {
  return [state.session.streamId, extensionUiRefreshKey(state), state.session.historyPageRevision, geometry.width, geometry.height, state.selectedSessionId, state.session.snapshot?.sessionId, state.session.connection, state.extensionUiRenderIntervalMs].join("|");
}


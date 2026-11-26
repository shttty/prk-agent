import { extensionUiRefreshKey } from "./extension-ui-refresh-key.ts";
import type { WorkbenchState } from "../../workbench/store/store-types.ts";
export function extensionUiRenderTriggerKey(state: WorkbenchState, geometry: { width: number; height: number }) {
  return [state.session.streamId, extensionUiRefreshKey(state), state.session.historyPageRevision, geometry.width, geometry.height, state.selectedSessionId, state.session.snapshot?.sessionId, state.session.connection, state.extensionUiRenderIntervalMs].join("|");
}


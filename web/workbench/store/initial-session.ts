import type { SelectedSessionState } from "./store-types.ts";
import { requestId } from "./requests/request-id.ts";

export function initialSession(streamId: string | null = null): SelectedSessionState {
  return {
    streamId,
    lastSequence: 0,
    snapshot: null,
    historyPage: { loading: false, error: "" },
    historyPageRevision: 0,
    extensionUi: null,
    extensionUiRender: null,
    extensionUiClientId: requestId(),
    extensionUiRenderRequest: 0,
    extensionUiRenderAcceptedRequest: 0,
    connection: "disconnected",
    pending: new Set(),
    localMessages: new Map(),
    operations: new Map(),
    streams: new Map(),
    runStage: null,
    toolRuns: new Map(),
    toolContents: new Map(),
    activities: [],
    nativeCatalog: { value: null, loading: false, error: null },
    nativeFeedback: [],
    referenceCandidates: { value: [], truncated: false, loading: false, error: null },
    restoredDraft: null,
    banner: null,
    error: null,
    notice: null,
    presentationRevision: 0,
    transcriptRevision: 0,
    terminalRefreshKey: 0,
    recoveryMessage: "",
  };
}

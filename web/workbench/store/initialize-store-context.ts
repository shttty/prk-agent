import type { StoreContext } from "./store-context-types.ts";
import { createSessionStorage } from "../session-storage/assemble-session-storage.ts";
import { setNotice } from "./notices/set-notice.ts";
import { initialState } from "./initial-state.ts";
import { handleLocationChange } from "./lifecycle/handle-location-change.ts";
import { handleConnectionResume } from "./lifecycle/handle-connection-resume.ts";
import { flushScroll } from "./drafts/flush-scroll.ts";

export function initializeStoreContext(apiRoot: string): StoreContext {
  const ctx: StoreContext = {
    apiRoot,
    state: initialState(),
    listeners: new Set(),
    storage: createSessionStorage({ apiRoot, onStorageFailure: (message) => setNotice(ctx, message, "warning") }),
    source: null,
    workbenchSource: null,
    selectionToken: 0,
    disposed: false,
    referenceRequestToken: 0,
    locationListenerInstalled: false,
    draftRevision: 0,
    renderTimer: undefined,
    renderPending: null,
    renderFlight: null,
    renderStartedAt: 0,
    displayNotifyCancel: null,
    toolContentRequests: new Map(),
    wakeRequests: new Map(),
    sendChecks: new Set(),
    noticeTimer: undefined,
    scrollSample: null,
    scrollTimer: undefined,
    historyRefresh: undefined,
    pageListeners: { locationChange: () => handleLocationChange(ctx), connectionResume: () => handleConnectionResume(ctx), flushScroll: () => flushScroll(ctx) },
  };
  return ctx;
}

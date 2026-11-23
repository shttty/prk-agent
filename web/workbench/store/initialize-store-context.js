import { createSessionStorage } from "../session-storage/assemble-session-storage.js";
import { setNotice } from "./notices/set-notice.js";
import { initialState } from "./initial-state.js";
export function initializeStoreContext(ctx) {
ctx.state = initialState();
  ctx.listeners = new Set();
  ctx.storage = createSessionStorage({ apiRoot: ctx.apiRoot, onStorageFailure: (message) => setNotice(ctx, message, "warning") });
  ctx.source = null;
  ctx.workbenchSource = null;
  ctx.selectionToken = 0;
  ctx.disposed = false;
  ctx.referenceRequestToken = 0;
  ctx.locationListenerInstalled = false;
  ctx.draftRevision = 0;
  ctx.renderTimer = null;
  ctx.renderPending = null;
  ctx.renderFlight = null;
  ctx.renderStartedAt = 0;
  ctx.displayNotifyCancel = null;
  ctx.toolContentRequests = new Map();
  ctx.noticeTimer = undefined;
  ctx.scrollSample = null;
  ctx.scrollTimer = undefined;
}

import { persistCurrentSession } from "../drafts/persist-current-session.js";
import { closeEventSource } from "../session-stream/close-event-source.js";
import { closeWorkbenchEventSource } from "../workbench-snapshot/close-workbench-event-source.js";
import { flushDisplayNotify } from "../updates/flush-display-notify.js";
import { flushScroll } from "../drafts/flush-scroll.js";
export function dispose(ctx) {
    if (ctx.disposed) return;
    flushScroll(ctx);
    persistCurrentSession(ctx);
    ++ctx.selectionToken;
    if (ctx.locationListenerInstalled && typeof globalThis.removeEventListener === "function") globalThis.removeEventListener("popstate", ctx.bound.handleLocationChange);
    globalThis.removeEventListener?.("online", ctx.bound.handleConnectionResume);
    globalThis.document?.removeEventListener("visibilitychange", ctx.bound.handleConnectionResume);
    globalThis.removeEventListener?.("pagehide", ctx.bound.flushScroll);
    globalThis.document?.removeEventListener("visibilitychange", ctx.bound.flushScroll);
    ctx.locationListenerInstalled = false;
    closeEventSource(ctx);
    closeWorkbenchEventSource(ctx);
    ctx.disposed = true;
    flushDisplayNotify(ctx);
    ctx.listeners.clear();
  }


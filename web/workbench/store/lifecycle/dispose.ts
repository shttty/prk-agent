import type { StoreContext } from "../store-context-types.ts";
import { persistCurrentSession } from "../drafts/persist-current-session.ts";
import { closeEventSource } from "../session-stream/close-event-source.ts";
import { closeWorkbenchEventSource } from "../workbench-snapshot/close-workbench-event-source.ts";
import { flushDisplayNotify } from "../updates/flush-display-notify.ts";
import { flushScroll } from "../drafts/flush-scroll.ts";

export function dispose(ctx: StoreContext) {
  if (ctx.disposed) return;
  flushScroll(ctx);
  persistCurrentSession(ctx);
  ++ctx.selectionToken;
  if (ctx.locationListenerInstalled) {
    const { locationChange, connectionResume, flushScroll: flush } = ctx.pageListeners;
    globalThis.removeEventListener("popstate", locationChange);
    globalThis.removeEventListener("online", connectionResume);
    globalThis.document?.removeEventListener("visibilitychange", connectionResume);
    globalThis.removeEventListener("pagehide", flush);
    globalThis.document?.removeEventListener("visibilitychange", flush);
  }
  ctx.locationListenerInstalled = false;
  closeEventSource(ctx);
  closeWorkbenchEventSource(ctx);
  ctx.disposed = true;
  flushDisplayNotify(ctx);
  ctx.listeners.clear();
}

import type { StoreContext } from "../store-context-types.ts";
import { closeWorkbenchEventSource } from "../workbench-snapshot/close-workbench-event-source.ts";
import { openWorkbenchEventSource } from "../workbench-snapshot/open-workbench-event-source.ts";
import { reconnect } from "../session-stream/reconnect.ts";

export function handleConnectionResume(ctx: StoreContext) {
  if (ctx.disposed || globalThis.document?.visibilityState === "hidden") return;
  if (!ctx.workbenchSource || ctx.workbenchSource.readyState === EventSource.CLOSED) {
    closeWorkbenchEventSource(ctx);
    openWorkbenchEventSource(ctx);
  }
  if (ctx.state.selectedSessionId && (!ctx.source || ctx.source.readyState === EventSource.CLOSED)) void reconnect(ctx);
}

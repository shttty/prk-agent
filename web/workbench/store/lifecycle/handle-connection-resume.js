import { closeWorkbenchEventSource } from "../workbench-snapshot/close-workbench-event-source.js";
import { openWorkbenchEventSource } from "../workbench-snapshot/open-workbench-event-source.js";
import { reconnect } from "../session-stream/reconnect.js";
export function handleConnectionResume(ctx) {
    if (ctx.disposed || globalThis.document?.visibilityState === "hidden") return;
    if (!ctx.workbenchSource || ctx.workbenchSource.readyState === 2) {
      closeWorkbenchEventSource(ctx);
      openWorkbenchEventSource(ctx);
    }
    if (ctx.state.selectedSessionId && (!ctx.source || ctx.source.readyState === 2)) void reconnect(ctx);
  }


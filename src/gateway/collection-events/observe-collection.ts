import type { HostContext } from "../host/host-state.ts";
import { projectToolDetails } from "../tool-content/format-details.ts";

export function observeCollection(ctx: HostContext): void {
  ctx.events.unsubscribeCollection = ctx.host.collection.subscribe((event) => {
    if (event.type === "session_closed") ctx.lifecycle.recoveryStates.delete(event.sessionId);
  if (event.type !== "session_attention_changed") ctx.methods.reconcileMonitor();
  if (ctx.host.history.get(event.sessionId)?.sleeping) return;
    if (event.type === "session_renamed") return ctx.methods.publish("session_renamed", ctx.methods.storedSession(event.sessionId));
    const published = event.details ? { ...event, details: projectToolDetails(event.details, ctx.host.config.toolContent) } : event;
    for (const listener of [...ctx.events.listeners]) {
      if (!ctx.events.listeners.has(listener)) continue;
   try { void Promise.resolve(listener(published)).catch(() => { }); }
      catch { /* An observer cannot change session lifecycle. */ }
    }
  });
}

import type { HostContext, SessionHostEventType, SessionHostEvent } from "../host-types.ts";

export function emit(ctx: HostContext, type: SessionHostEventType, details: Omit<SessionHostEvent, "sequence" | "timestamp" | "type" | "sessionId" | "streamId"> = {}): void {
  if (ctx.closed) return;
  const event = { sequence: ++ctx.sequence, timestamp: new Date().toISOString(), type, sessionId: ctx.sessionId, streamId: ctx.streamId, ...details };
  ctx.deliveries.push(event);
  if (ctx.dispatching) return;
  ctx.dispatching = true;
  try {
    for (let next = ctx.deliveries.shift(); next; next = ctx.deliveries.shift()) {
      for (const listener of [...ctx.listeners]) {
        if (!ctx.listeners.has(listener)) continue;
        try { void Promise.resolve(listener(structuredClone(next))).catch(() => { }); }
        catch { /* An observer cannot change execution. */ }
      }
    }
  } finally { ctx.dispatching = false; }
}

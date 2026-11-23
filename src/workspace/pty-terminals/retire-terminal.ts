import type { PtyContext, PtyEntry } from "./terminal-state.ts";
import { publishEvent } from "./publish-event.ts";

/** Retires routing identity, not a claim that target processes are dead. */
export function retireTerminal(ctx: PtyContext, entry: PtyEntry, reason?: unknown): void {
  if (entry.closed) return;
  entry.closed = true;
  entry.rejectHandshake(reason ?? new Error("PTY shell ended before startup completed."));
  entry.finishIntegration();
  entry.stopAbort?.();
  const sessions = ctx.sessions.get(entry.sessionId);
  if (sessions?.get(entry.name) === entry) {
    sessions.delete(entry.name);
    if (!sessions.size) ctx.sessions.delete(entry.sessionId);
  }
  publishEvent(entry, { type: "closed" });
  entry.listeners.clear();
  if (reason !== undefined) ctx.options.onCleanupUnknown(reason, entry.sessionId, entry.name);
  entry.release = entry.lease?.release();
  void entry.release?.catch((error) => ctx.options.onCleanupUnknown(error, entry.sessionId, entry.name));
}

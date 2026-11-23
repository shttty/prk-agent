import type { HostContext } from "../host/host-state.ts";
import type { StoredSession } from "../../sessions/history/history-types.ts";
import type { SessionLifecycleEvent } from "../../sessions/collection/collection-types.ts";

/** Events after which the session's workbench row changed; they carry that row so observers upsert it. */
const ROW_EVENTS = new Set(["session_derivation_changed", "session_renamed", "session_unarchived", "session_recovered", "session_recovery_failed", "session_project_assigned", "session_project_renamed"]);

export function publish(ctx: HostContext, type: string, entry: StoredSession, details?: Readonly<Record<string, unknown>>): void {
    const rolesChanged = type !== "session_monitor" && type !== "session_ask" && ctx.methods.refreshSessionControl();
    if (type !== "session_monitor" && type !== "session_ask") { ctx.methods.reconcileMonitor(); ctx.methods.reconcileAsk(); }
    dispatch(ctx, type, entry.sessionId, { ...details, ...changedRow(ctx, type, entry, details) });
    // Membership changes re-elect roles; observers get the new designations as their own event.
    if (rolesChanged && type !== "session_control_changed") dispatch(ctx, "session_control_changed", entry.sessionId, {});
  }

function dispatch(ctx: HostContext, type: string, sessionId: string, details: Record<string, unknown>): void {
  const merged = type === "session_control_changed" ? { ...details, sessionControl: ctx.methods.sessionControl() } : details;
  const event = { type, sessionId, timestamp: new Date().toISOString(), ...(Object.keys(merged).length ? { details: merged } : {}) } as SessionLifecycleEvent;
  const failed = () => { console.error(`[${new Date().toISOString()}] Gateway history observer failed; the durable operation remains authoritative.`); };
  for (const listener of [...ctx.events.listeners]) {
    try { void Promise.resolve(listener(event)).catch(failed); }
    catch { failed(); }
  }
}

/** The one row this event changed: the session's row, or for an archive its archive group. Unreadable rows are omitted. */
function changedRow(ctx: HostContext, type: string, entry: StoredSession, details?: Readonly<Record<string, unknown>>): Record<string, unknown> {
  try {
    if (type === "session_archived") {
      const archiveGroup = ctx.methods.archiveGroups([]).find((group) => group.group === details?.group);
      return archiveGroup === undefined ? {} : { archiveGroup };
    }
    const current = ROW_EVENTS.has(type) ? ctx.host.history.get(entry.sessionId) : undefined;
    return current === undefined || current.archived ? {} : { session: ctx.methods.managedSessionSnapshot(current) };
  } catch { return {}; }
}

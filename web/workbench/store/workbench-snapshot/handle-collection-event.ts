import type { StoreContext } from "../store-context-types.ts";
import type { SessionRow } from "../store-types.ts";
import { parseEvent } from "../../payloads/parse-event.ts";
import { isRecord } from "../../payloads/is-record.ts";
import { closeEventSource } from "../session-stream/close-event-source.ts";
import { updateSessionRow } from "./update-session-row.ts";
import { patchSession } from "../updates/patch-session.ts";
import { withPending } from "../updates/with-pending.ts";
import { stampMonitor } from "../../../monitor/readings/stamp-monitor.js";
import { loadNativeCatalog } from "../native-actions/load-native-catalog.ts";
import { applyRowEvent } from "./apply-row-event.ts";
import { reconnect } from "../session-stream/reconnect.ts";
import { normalizeSessionControl } from "../session-control/normalize-session-control.ts";
import { patch } from "../updates/patch.ts";
import { applyTargetEnvironment } from "../targets/apply-target-environment.ts";
import { normalizeEnvironment } from "../../payloads/normalize-environment.ts";

const BACKGROUND_ROW_STATES = new Map<string, SessionRow["state"]>([
  ["session_starting", "starting"],
  ["session_running", "running"],
  ["session_idle", "idle"],
  ["session_sleeping", "sleeping"],
  ["session_awake", "idle"],
  ["session_closed", "closed"],
]);
const ROW_EVENTS = ["session_derivation_changed", "session_archived", "session_unarchived", "session_purged", "session_renamed", "session_recovered", "session_recovery_failed", "archive_group_updated", "session_project_assigned", "session_project_renamed"];
const NO_ATTENTION = { blocked: false, asking: false, stopped: false, retryPending: false, background: false };

/** One frame of the collection stream: it moves a row, a role designation, an instance environment or the selected session. */
export function handleCollectionEvent(ctx: StoreContext, current: EventSource, event: Event) {
  if (ctx.workbenchSource !== current) return;
  const payload = parseEvent(event);
  if (!isRecord(payload) || typeof payload.type !== "string") return;
  const { type } = payload;
  const details = isRecord(payload.details) ? payload.details : {};
  const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : null;
  const selected = ctx.state.selectedSessionId;
  if (type === "session_control_changed" && isRecord(details.sessionControl)) patch(ctx, { sessionControl: normalizeSessionControl(details.sessionControl) });
  if (type === "target_environment_changed") applyTargetEnvironment(ctx, normalizeEnvironment(details.environment));
  // The selected row lifecycle is already driven by its own host stream.
  const rowState = BACKGROUND_ROW_STATES.get(type);
  if (rowState && sessionId && sessionId !== selected && ctx.state.sessions.has(sessionId)) {
    const done = rowState === "idle" && details.completed === true;
    updateSessionRow(ctx, sessionId, { state: rowState, ...(done ? { done: true } : {}), compacting: details.compacting === true, ...(rowState === "closed" || rowState === "sleeping" ? NO_ATTENTION : {}) });
  }
  if (type === "session_closed" && sessionId && sessionId === selected) {
    closeEventSource(ctx);
    updateSessionRow(ctx, sessionId, { state: "closed", ...NO_ATTENTION });
    // The sessionRow stream may have ended first and started an automatic retry; the session is closed, so that retry is over too.
    const snapshot = ctx.state.session.snapshot;
    patchSession(ctx, { snapshot: snapshot ? { ...snapshot, state: "closed" } : null, connection: "disconnected", pending: withPending(ctx.state.session.pending, "reconnecting", false) });
  }
  if (type === "session_monitor" && sessionId && isRecord(details.monitor) && ctx.state.sessions.has(sessionId)) {
    // The Gateway's own reading; this page only adds when it arrived.
    updateSessionRow(ctx, sessionId, { monitor: stampMonitor(details.monitor) });
  }
  if (type === "session_attention_changed" && sessionId && ctx.state.sessions.has(sessionId)) {
    updateSessionRow(ctx, sessionId, { blocked: details.blocked === true, asking: details.asking === true, stopped: details.stopped === true, retryPending: details.retryPending === true, background: details.background === true });
  }
  if (type === "session_capabilities_changed" && sessionId) {
    const requiresReload = details.requiresReload === true;
    updateSessionRow(ctx, sessionId, { requiresReload });
    if (sessionId === selected) {
      const snapshot = ctx.state.session.snapshot;
      if (snapshot) patchSession(ctx, { snapshot: { ...snapshot, requiresReload } });
      void loadNativeCatalog(ctx, sessionId);
    }
  }
  if (ROW_EVENTS.includes(type)) applyRowEvent(ctx, payload);
  const projectChanged = type === "session_project_assigned" || type === "session_project_renamed";
  const snapshot = ctx.state.session.snapshot;
  if (projectChanged && sessionId === selected && snapshot && isRecord(details.session)) {
    patchSession(ctx, { snapshot: { ...snapshot, requiresReload: details.session.requiresReload === true } });
  }
  if ((type === "session_recovered" || type === "session_recovery_failed") && sessionId === selected) {
    // WEB-19: a fresh subscription's first snapshot is the authoritative state after recovery.
    closeEventSource(ctx);
    void reconnect(ctx);
  }
}

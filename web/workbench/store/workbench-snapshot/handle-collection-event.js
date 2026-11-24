import { parseEvent } from "../../payloads/parse-event.js";
import { isRecord } from "../../payloads/is-record.js";
import { closeEventSource } from "../session-stream/close-event-source.js";
import { updateSessionRow } from "./update-session-row.js";
import { patchSession } from "../updates/patch-session.js";
import { withPending } from "../updates/with-pending.js";
import { stampMonitor } from "../../../monitor/readings/stamp-monitor.js";
import { loadNativeCatalog } from "../native-actions/load-native-catalog.js";
import { applyRowEvent } from "./apply-row-event.js";
import { reconnect } from "../session-stream/reconnect.js";
import { normalizeSessionControl } from "../session-control/normalize-session-control.js";
import { patch } from "../updates/patch.js";
import { applyTargetEnvironment } from "../targets/apply-target-environment.js";
import { normalizeEnvironment } from "../../payloads/normalize-environment.js";
const BACKGROUND_ROW_STATES = new Map([
  ["session_starting", "starting"],
  ["session_running", "running"],
  ["session_idle", "idle"],
  ["session_sleeping", "sleeping"],
  ["session_awake", "idle"],
  ["session_closed", "closed"],
]);

export function handleCollectionEvent(ctx, current, event) {
      if (ctx.workbenchSource !== current) return;
      const payload = parseEvent(event);
      if (!isRecord(payload)) return;
      if (payload.type === "session_control_changed" && isRecord(payload.details?.sessionControl)) patch(ctx, { sessionControl: normalizeSessionControl(payload.details.sessionControl) });
      if (payload.type === "target_environment_changed") applyTargetEnvironment(ctx, normalizeEnvironment(payload.details?.environment));
      // The selected row is already driven by its own host stream.
      const rowState = BACKGROUND_ROW_STATES.get(payload.type);
      if (rowState && payload.sessionId !== ctx.state.selectedSessionId && ctx.state.sessions.has(payload.sessionId)) {
        updateSessionRow(ctx, payload.sessionId, { state: rowState, compacting: payload.details?.compacting === true });
      }
      if (payload.type === "session_closed" && payload.sessionId === ctx.state.selectedSessionId) {
        closeEventSource(ctx);
        updateSessionRow(ctx, payload.sessionId, { state: "closed" });
        // The sessionRow stream may have ended first and started an automatic retry; the session is closed, so that retry is over too.
        patchSession(ctx, { snapshot: ctx.state.session.snapshot ? { ...ctx.state.session.snapshot, state: "closed" } : null, connection: "disconnected", pending: withPending(ctx.state.session.pending, "reconnecting", false) });
      }
      if (payload.type === "session_monitor" && typeof payload.sessionId === "string" && isRecord(payload.details?.monitor) && ctx.state.sessions.has(payload.sessionId)) {
        updateSessionRow(ctx, payload.sessionId, { monitor: stampMonitor(payload.details.monitor) });
      }
      if (payload.type === "session_ask" && typeof payload.sessionId === "string" && ctx.state.sessions.has(payload.sessionId)) {
        updateSessionRow(ctx, payload.sessionId, { asking: payload.details?.asking === true });
      }
      if (payload.type === "session_capabilities_changed" && typeof payload.sessionId === "string") {
        const requiresReload = payload.details?.requiresReload === true;
        updateSessionRow(ctx, payload.sessionId, { requiresReload });
        if (payload.sessionId === ctx.state.selectedSessionId) {
          if (ctx.state.session.snapshot) patchSession(ctx, { snapshot: { ...ctx.state.session.snapshot, requiresReload } });
          void loadNativeCatalog(ctx, payload.sessionId);
        }
      }
      const projectChanged = payload.type === "session_project_assigned" || payload.type === "session_project_renamed";
      if (projectChanged || ["session_derivation_changed", "session_archived", "session_unarchived", "session_purged", "session_renamed", "session_recovered", "session_recovery_failed", "archive_group_updated"].includes(payload.type)) applyRowEvent(ctx, payload);
      if (projectChanged && payload.sessionId === ctx.state.selectedSessionId && ctx.state.session.snapshot && isRecord(payload.details?.session)) {
        patchSession(ctx, { snapshot: { ...ctx.state.session.snapshot, requiresReload: payload.details.session.requiresReload === true } });
      }
      if (["session_recovered", "session_recovery_failed"].includes(payload.type) && payload.sessionId === ctx.state.selectedSessionId) {
        // WEB-19: a fresh subscription's first snapshot is the authoritative state after recovery.
        closeEventSource(ctx);
        void reconnect(ctx);
      }
    }

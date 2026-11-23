import { isRecord } from "../../payloads/is-record.js";
import { normalizeSession } from "../../payloads/normalize-session.js";
import { patchSession } from "../updates/patch-session.js";
import { patch } from "../updates/patch.js";
import { normalizeTarget } from "../../payloads/normalize-target.js";
import { normalizeUnreadableSession } from "../../payloads/normalize-unreadable-session.js";
import { unreadableSelection } from "../selection/unreadable-selection.js";
import { clearSelection } from "../selection/clear-selection.js";
import { normalizeSessionControl } from "../session-control/normalize-session-control.js";
import { newerEnvironment } from "../targets/newer-environment.js";
export function applyWorkbenchSnapshot(ctx, body) {
    if (!isRecord(body) || !Array.isArray(body.targets) || !Array.isArray(body.sessions)) {
      throw new Error("配置变更结果未确认。");
    }
    const sessions = new Map();
    for (const value of body.sessions) {
      const sessionRow = normalizeSession(value);
      if (sessionRow) sessions.set(sessionRow.sessionId, sessionRow);
    }
    const unreadableSessions = Array.isArray(body.unreadableSessions) ? body.unreadableSessions.map(normalizeUnreadableSession).filter(Boolean) : [];
    // A session that became unreadable is no longer a chat: close it instead of carrying its stale sessionRow over.
    if (unreadableSelection(ctx, unreadableSessions)) {
      clearSelection(ctx, sessions);
    } else {
      if (ctx.state.selectedSessionId && ctx.state.sessions.has(ctx.state.selectedSessionId) && !sessions.has(ctx.state.selectedSessionId)) {
        sessions.set(ctx.state.selectedSessionId, ctx.state.sessions.get(ctx.state.selectedSessionId));
      }
      const selected = sessions.get(ctx.state.selectedSessionId);
      if (selected?.sessionId === ctx.state.session.snapshot?.sessionId && selected?.state === "sleeping") {
        patchSession(ctx, { snapshot: { ...ctx.state.session.snapshot, state: "sleeping" } });
      }
    }
    patch(ctx, {
      // A snapshot (stream frame or an HTTP mutation answer) never rolls an instance's environment back within its stream.
      targets: body.targets.map(normalizeTarget).filter(Boolean).map((target) => {
        const environment = newerEnvironment(ctx.state.targets.find((item) => item.id === target.id)?.environment, target.environment);
        return environment ? { ...target, environment } : target;
      }),
      sessions,
      archive: Array.isArray(body.archive) ? body.archive.filter((group) => isRecord(group) && typeof group.group === "string" && Array.isArray(group.sessions)) : [],
      unreadableSessions,
      sessionControl: normalizeSessionControl(body.sessionControl),
      service: "ready",
    });
  }


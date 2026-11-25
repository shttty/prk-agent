import { isRecord } from "../../payloads/is-record.js";
import { normalizeSession } from "../../payloads/normalize-session.js";
import { clearSelection } from "../selection/clear-selection.js";
import { patch } from "../updates/patch.js";
/**
 * Apply the one row a collection event carries: `details.session` upserts a session row, `session_archived` moves the
 * session into `details.archiveGroup`, and unarchive/purge dissolve `details.group` (the Gateway finished the whole
 * group before its first member event).
 */
export function applyRowEvent(ctx, payload) {
  const row = normalizeSession(payload.details?.session);
  const group = typeof payload.details?.group === "string" ? payload.details.group : null;
  let archive = ctx.state.archive;
  if (["session_unarchived", "session_purged"].includes(payload.type) && group) archive = archive.filter((entry) => entry.group !== group);
  const archiveGroup = payload.details?.archiveGroup;
  if ((payload.type === "session_archived" || payload.type === "archive_group_updated") && isRecord(archiveGroup) && typeof archiveGroup.group === "string" && Array.isArray(archiveGroup.sessions)) {
    archive = [archiveGroup, ...archive.filter((entry) => entry.group !== archiveGroup.group)].sort((left, right) => String(right.at).localeCompare(String(left.at)));
  }
  const sessions = new Map(ctx.state.sessions);
  if (row) sessions.set(row.sessionId, { ...row, ...(ctx.state.sessions.get(row.sessionId)?.done ? { done: true } : {}) });
  if (payload.type === "session_archived" && typeof payload.sessionId === "string") {
    ctx.storage.forgetSession(payload.sessionId);
    sessions.delete(payload.sessionId);
    if (ctx.state.selectedSessionId === payload.sessionId) {
      patch(ctx, { archive });
      clearSelection(ctx, sessions);
      return;
    }
  }
  patch(ctx, { sessions, archive });
}

import type { ArchiveGroup } from "../../../../src/gateway/wire/web-types.ts";
import type { StoreContext } from "../store-context-types.ts";
import { isRecord } from "../../payloads/is-record.ts";
import { normalizeSession } from "../../payloads/normalize-session.ts";
import { clearSelection } from "../selection/clear-selection.ts";
import { patch } from "../updates/patch.ts";

/**
 * Apply the one row a collection event carries: `details.session` upserts a session row, `session_archived` moves the
 * session into `details.archiveGroup`, and unarchive/purge dissolve `details.group` (the Gateway finished the whole
 * group before its first member event).
 */
export function applyRowEvent(ctx: StoreContext, payload: Record<string, unknown>) {
  const details = isRecord(payload.details) ? payload.details : {};
  const row = normalizeSession(details.session);
  const group = typeof details.group === "string" ? details.group : null;
  let archive = ctx.state.archive;
  if ((payload.type === "session_unarchived" || payload.type === "session_purged") && group) archive = archive.filter((entry) => entry.group !== group);
  const archiveGroup = details.archiveGroup;
  if ((payload.type === "session_archived" || payload.type === "archive_group_updated") && isRecord(archiveGroup) && typeof archiveGroup.group === "string" && Array.isArray(archiveGroup.sessions)) {
    const updated = archiveGroup as unknown as ArchiveGroup;
    archive = [updated, ...archive.filter((entry) => entry.group !== updated.group)].sort((left, right) => String(right.at).localeCompare(String(left.at)));
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

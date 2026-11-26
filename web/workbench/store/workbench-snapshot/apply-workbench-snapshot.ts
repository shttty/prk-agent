import type { StoreContext } from "../store-context-types.ts";
import type { SessionRow } from "../store-types.ts";
import { isRecord } from "../../payloads/is-record.ts";
import { normalizeSession } from "../../payloads/normalize-session.ts";
import { patchSession } from "../updates/patch-session.ts";
import { patch } from "../updates/patch.ts";
import { normalizeTarget } from "../../payloads/normalize-target.ts";
import { normalizeUnreadableSession } from "../../payloads/normalize-unreadable-session.ts";
import { unreadableSelection } from "../selection/unreadable-selection.ts";
import { clearSelection } from "../selection/clear-selection.ts";
import { normalizeSessionControl } from "../session-control/normalize-session-control.ts";
import { newerEnvironment } from "../targets/newer-environment.ts";
import type { ArchiveGroup } from "../../../../src/gateway/wire/web-types.ts";

/** Take a whole workbench (stream snapshot or an instance mutation's answer) as the page's base. Throws when it is not one. */
export function applyWorkbenchSnapshot(ctx: StoreContext, body: unknown) {
  if (!isRecord(body) || !Array.isArray(body.targets) || !Array.isArray(body.sessions)) {
    throw new Error("配置变更结果未确认。");
  }
  const sessions = new Map<string, SessionRow>();
  for (const value of body.sessions) {
    const sessionRow = normalizeSession(value);
    if (sessionRow) sessions.set(sessionRow.sessionId, { ...sessionRow, ...(ctx.state.sessions.get(sessionRow.sessionId)?.done ? { done: true } : {}) });
  }
  const unreadableSessions = Array.isArray(body.unreadableSessions) ? body.unreadableSessions.map(normalizeUnreadableSession).filter((issue) => issue !== null) : [];
  // A session that became unreadable is no longer a chat: close it instead of carrying its stale sessionRow over.
  if (unreadableSelection(ctx, unreadableSessions)) {
    clearSelection(ctx, sessions);
  } else {
    const selectedId = ctx.state.selectedSessionId;
    const previousRow = selectedId ? ctx.state.sessions.get(selectedId) : undefined;
    if (selectedId && previousRow && !sessions.has(selectedId)) sessions.set(selectedId, previousRow);
    const selected = selectedId ? sessions.get(selectedId) : undefined;
    const held = ctx.state.session.snapshot;
    if (held && selected?.sessionId === held.sessionId && selected.state === "sleeping") patchSession(ctx, { snapshot: { ...held, state: "sleeping" } });
  }
  patch(ctx, {
    // A snapshot (stream frame or an HTTP mutation answer) never rolls an instance's environment back within its stream.
    targets: body.targets.map(normalizeTarget).filter((target) => target !== null).map((target) => {
      const current = ctx.state.targets.find((item) => item.id === target.id)?.environment;
      const environment = target.environment ? newerEnvironment(current, target.environment) : current;
      return environment ? { ...target, environment } : target;
    }),
    sessions,
    archive: Array.isArray(body.archive) ? body.archive.filter((group): group is ArchiveGroup => isRecord(group) && typeof group.group === "string" && Array.isArray(group.sessions)) : [],
    unreadableSessions,
    sessionControl: normalizeSessionControl(body.sessionControl),
    service: "ready",
  });
}

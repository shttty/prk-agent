import type { HistoryContext, StoredSession } from "../history-types.ts";
import { projectReadableSessions } from "./project-readable-sessions.ts";

export function listArchived(ctx: HistoryContext): readonly StoredSession[] {
  return Object.freeze(projectReadableSessions(ctx, ctx.records.values()).filter((entry) => entry.archived !== undefined));
}

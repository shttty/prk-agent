import type { HistoryContext, StoredSession } from "../history-types.ts";
import { projectReadableSessions } from "./project-readable-sessions.ts";

export function list(ctx: HistoryContext): readonly StoredSession[] {
  return projectReadableSessions(ctx, ctx.records.values());
}

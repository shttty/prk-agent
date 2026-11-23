import type { HostContext } from "../../host/host-state.ts";
import type { BranchHistoryPage, HistoryPageCursor } from "../../../sessions/history/history-types.ts";
import { projectHistoryPage } from "./project-history-page.ts";

export function historyPage(ctx: HostContext, sessionId: string, cursor: HistoryPageCursor): BranchHistoryPage {
  const entry = ctx.methods.stored(sessionId);
  const manager = ctx.host.collection.get(sessionId)?.session.sessionManager ?? entry.manager;
  return projectHistoryPage(ctx, manager, cursor);
}

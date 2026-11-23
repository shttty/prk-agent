import type { SessionManager } from "@earendil-works/pi-coding-agent";
import type { HostContext } from "../../host/host-state.ts";
import type { BranchHistoryPage, HistoryPageCursor } from "../../../sessions/history/history-types.ts";
import { HistoryTurnTooLarge, projectBranchPage } from "../../../sessions/history/project-branch-page.ts";
import { projectMessage } from "../../tool-content/projection/format-message.ts";
import { WireError } from "../../wire/create-error.ts";

export function projectHistoryPage(ctx: HostContext, manager: SessionManager, cursor: HistoryPageCursor = {}): BranchHistoryPage {
  const { limits, http, toolContent } = ctx.host.config;
  const bytes = Math.min(limits.historyPageBytes, Math.floor(Math.min(limits.outputBytes, http.outputBytes) / 2));
  try {
    const page = projectBranchPage(manager, cursor, { bytes, projectMessage: (message) => projectMessage(message, toolContent) });
    if (!page) throw new WireError("NOT_FOUND", "History cursor is not on the current branch.");
    return page;
  } catch (error) {
    if (!(error instanceof HistoryTurnTooLarge)) throw error;
    throw new WireError("TOO_LARGE", error.message, { entryId: error.entryId, bytes: error.bytes, budgetBytes: error.budgetBytes });
  }
}

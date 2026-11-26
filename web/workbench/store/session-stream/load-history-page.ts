import type { StoreContext } from "../store-context-types.ts";
import { validHistoryPage } from "./validate-history-page.ts";
import { getJson } from "../requests/get-json.ts";
import { patchSession } from "../updates/patch-session.ts";
import { reconcileHistoryToolRuns } from "./reconcile-history-tool-runs.ts";

/** Read the page of history before the loaded part and put it in front; `beforePrepend` runs just before, for scroll anchoring. */
export async function loadHistoryPage(ctx: StoreContext, beforePrepend?: () => void): Promise<boolean> {
  const { snapshot, streamId, historyPage } = ctx.state.session;
  const sessionId = ctx.state.selectedSessionId;
  const before = snapshot?.historyBefore;
  const selectionToken = ctx.selectionToken;
  if (!sessionId || !before || historyPage.loading) return false;
  const current = () => !ctx.disposed && ctx.selectionToken === selectionToken && ctx.state.selectedSessionId === sessionId
    && ctx.state.session.streamId === streamId && ctx.state.session.snapshot?.historyBefore === before;
  patchSession(ctx, { historyPage: { loading: true, error: "" } });
  try {
    const page = await getJson(`${ctx.apiRoot}/sessions/${encodeURIComponent(sessionId)}/history-page?${new URLSearchParams({ before })}`);
    const latest = ctx.state.session.snapshot;
    if (!current() || !latest) return false;
    if (!validHistoryPage(page)) throw new Error("服务返回的历史分页格式无效。");
    const ids = new Set(latest.messageEntryIds);
    if (page.messageEntryIds.some((id) => ids.has(id)) || page.historyBefore === before) throw new Error("历史分页边界无效。");
    const compactionIds = new Set(latest.compactionEntryIds);
    const compactions = new Map([...page.compactions, ...(latest.compactions || [])].filter((entry) => compactionIds.has(entry.entryId)).map((entry) => [entry.entryId, entry]));
    const merged = { ...latest, messages: [...page.messages, ...latest.messages], messageEntryIds: [...page.messageEntryIds, ...(latest.messageEntryIds ?? [])], historyBefore: page.historyBefore, historyForkBefore: page.historyForkBefore, compactions: [...compactions.values()] };
    beforePrepend?.();
    patchSession(ctx, { snapshot: merged, toolRuns: reconcileHistoryToolRuns(merged, ctx.state.session.toolRuns, sessionId), historyPage: { loading: false, error: "" }, historyPageRevision: ctx.state.session.historyPageRevision + 1 });
    return true;
  } catch (error) {
    if (current()) patchSession(ctx, { historyPage: { loading: false, error: error instanceof Error ? error.message : "读取更早历史失败。" } });
    return false;
  }
}

import { getJson } from "../requests/get-json.js";
import { patchSession } from "../updates/patch-session.js";
import { setBanner } from "../notices/set-banner.js";
import { mergeLoadedHistory } from "./merge-loaded-history.js";
import { reconcileHistoryToolRuns } from "./reconcile-history-tool-runs.js";
import { validHistoryPage } from "./validate-history-page.js";

export async function refreshHistory(ctx, through) {
  const { snapshot, streamId } = ctx.state.session;
  const { sessionId } = snapshot;
  const selection = ctx.selectionToken;
  if (ctx.historyRefresh?.through === through && ctx.historyRefresh.streamId === streamId) return;
  if (snapshot.historyThrough === through) { ctx.historyRefresh = undefined; return; }
  const pending = { through, streamId };
  ctx.historyRefresh = pending;
  const current = () => !ctx.disposed && ctx.selectionToken === selection && ctx.historyRefresh === pending
    && ctx.state.session.streamId === streamId;
  // message_end appends an unindexed preview. This page settles only previews seen at the announced boundary.
  const previewCount = snapshot.messages.length - (snapshot.messageEntryIds?.length || 0);
  try {
    const url = `${ctx.apiRoot}/sessions/${encodeURIComponent(sessionId)}/history-page?${new URLSearchParams({ through: through ?? "" })}`;
    const page = await getJson(ctx, url);
    if (!current()) return;
    if (!validHistoryPage(page)) throw new Error("服务返回的历史分页格式无效。");
    const latest = ctx.state.session.snapshot;
    const anchored = mergeLoadedHistory(latest, { ...latest, ...page, historyThrough: through });
    const newerPreviews = latest.messages.slice((latest.messageEntryIds?.length || 0) + previewCount);
    const merged = newerPreviews.length ? { ...anchored, messages: [...anchored.messages, ...newerPreviews] } : anchored;
    patchSession(ctx, {
      snapshot: merged,
      toolRuns: reconcileHistoryToolRuns(merged, ctx.state.session.toolRuns, sessionId),
      transcriptRevision: ctx.state.session.transcriptRevision + 1,
      ...(merged.historyBefore === latest.historyBefore ? {} : { historyPage: { loading: false, error: "" } }),
    });
  } catch (error) {
    if (current()) setBanner(ctx, error instanceof Error ? error.message : "读取最新历史失败。", "error");
  } finally {
    if (ctx.historyRefresh === pending) ctx.historyRefresh = undefined;
  }
}

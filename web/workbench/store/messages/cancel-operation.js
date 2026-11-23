import { activeOperation } from "../selection/active-operation.js";
import { sessionRequestCurrent } from "../selection/session-request-current.js";
import { postJson } from "../requests/post-json.js";
import { patchSession } from "../updates/patch-session.js";
import { mergeEntry } from "../updates/merge-entry.js";
import { restoreReturnedMessages } from "../drafts/restore-returned-messages.js";
import { withPending } from "../updates/with-pending.js";
import { persistCurrentSession } from "../drafts/persist-current-session.js";
import { setBanner } from "../notices/set-banner.js";
import { addActivity } from "../notices/add-activity.js";
import { safeText } from "../../payloads/safe-text.js";
import { setNotice } from "../notices/set-notice.js";
import { cellStopKey } from "./cell-stop-key.js";
export async function cancelOperation(ctx, target, askId) {
    const { state } = ctx;
    const name = state.selectedSessionId;
    const pendingKey = target?.cellOnly && target.cell ? cellStopKey(target.cell) : "stopping";
    if (!name || state.session.connection !== "connected" || state.session.pending.has(pendingKey)) return false;
    if (target && (target.sessionId !== name || target.streamId !== state.session.streamId)) return false;
    if (askId !== undefined && !state.session.extensionUi?.prompts?.some(({ id }) => id === askId)) return false;
    const operationId = target ? target.operationId : activeOperation(ctx)?.operationId;
    // Without an explicit selection only a lone live cell is taken; several are never chosen for the user.
    const activeCells = state.session.snapshot?.kernel?.activeCells ?? [];
    const seen = target ? target.cell : activeCells.length === 1 ? activeCells[0] : undefined;
    const cell = seen && { kernelId: seen.kernelId, cellId: seen.cellId };
    if (!operationId && !cell) return false;
    const isCurrent = sessionRequestCurrent(ctx);
    patchSession(ctx, { pending: withPending(state.session.pending, pendingKey, true) });
    try {
      const sessionPath = `${ctx.apiRoot}/sessions/${encodeURIComponent(name)}`;
      const result = operationId
        ? await postJson(ctx, `${sessionPath}/cancel`, { operationId, ...(cell ? { cell } : {}) })
        : await postJson(ctx, `${sessionPath}/kernel/interrupt`, { ...cell, ...(target?.cellOnly ? { cellOnly: true } : {}) });
      if (!isCurrent()) return false;
      if (operationId) patchSession(ctx, { operations: mergeEntry(ctx, ctx.state.session.operations, operationId, { cancelRequested: result?.status === "requested" }) });
      restoreReturnedMessages(ctx, operationId, result?.returnedMessages, name);
      if (!operationId) return result?.status === "requested";
      persistCurrentSession(ctx);
      if (result?.status === "requested") {
        // The terminal event can arrive before this response; never show a pending banner for a settled operation.
        if (!ctx.state.session.operations.get(operationId)?.completion) setBanner(ctx, "取消请求已送达，等待停止。", "warning", { kind: "cancel-pending", operationId });
        addActivity(ctx, { title: "已请求取消 · 等待终态", time: new Date().toISOString(), meta: operationId, tone: "notice" });
      } else addActivity(ctx, { title: `取消结果 · ${safeText(result?.status) || "未知"}`, time: new Date().toISOString(), meta: operationId, tone: result?.status === "not_found" ? "error" : "notice" });
      return result?.status === "requested";
    } catch (error) {
      if (!isCurrent()) return false;
      setBanner(ctx, "取消请求失败。", "error");
      setNotice(ctx, error instanceof Error ? error.message : "取消请求失败。", "error");
      return false;
    } finally {
      if (isCurrent()) patchSession(ctx, { pending: withPending(ctx.state.session.pending, pendingKey, false) });
    }
  }


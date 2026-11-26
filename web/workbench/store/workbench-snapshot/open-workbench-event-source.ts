import type { StoreContext } from "../store-context-types.ts";
import { handleCollectionEvent } from "./handle-collection-event.ts";
import { persistCurrentSession } from "../drafts/persist-current-session.ts";
import { applyWorkbenchSnapshot } from "./apply-workbench-snapshot.ts";
import { restoreSelection } from "./restore-selection.ts";
import { parseEvent } from "../../payloads/parse-event.ts";
import { selectSession } from "../selection/select-session.ts";
import { setError } from "../notices/set-error.ts";
import { setBanner } from "../notices/set-banner.ts";
import { patch } from "../updates/patch.ts";
import { errorMessage } from "../requests/error-message.ts";

/** The collection subscription's first snapshot is the workbench base; later snapshots (reconnects) re-base it. */
export function openWorkbenchEventSource(ctx: StoreContext) {
  if (typeof globalThis.EventSource !== "function" || ctx.workbenchSource) return;
  const current = new EventSource(`${ctx.apiRoot}/sessions/events`);
  ctx.workbenchSource = current;
  current.addEventListener("snapshot", (event) => {
    if (ctx.workbenchSource !== current) return;
    try {
      const first = ctx.state.service !== "ready";
      persistCurrentSession(ctx);
      applyWorkbenchSnapshot(ctx, parseEvent(event));
      if (first && !ctx.state.selectedSessionId) { restoreSelection(ctx); return; }
      const name = ctx.state.selectedSessionId;
      const sessionRow = name ? ctx.state.sessions.get(name) : undefined;
      const heldState = ctx.state.session.snapshot?.state;
      const recovered = (heldState === "closed" || heldState === "unavailable") && sessionRow && !["closed", "closing", "unavailable"].includes(sessionRow.state);
      if (name && recovered) void selectSession(ctx, name);
    } catch (error) { setError(ctx, error instanceof Error ? error.message : "工作台快照格式无效。"); }
  });
  current.addEventListener("collection", (event) => { handleCollectionEvent(ctx, current, event); });
  const disconnected = "会话列表连接已断开，正在重连。";
  const failed = "会话列表连接失败。";
  current.onopen = () => {
    if (ctx.workbenchSource !== current) return;
    patch(ctx, { workbenchLinked: true });
    const text = ctx.state.session.banner?.text;
    if (text === disconnected || text === failed) setBanner(ctx, null);
  };
  current.onerror = (event) => {
    if (ctx.workbenchSource !== current) return;
    // Pages waiting on Gateway progress (environment deploys) stop trusting it at once; reconnecting never resumes them.
    patch(ctx, { workbenchLinkLosses: ctx.state.workbenchLinkLosses + 1, workbenchLinked: false });
    if (event instanceof MessageEvent && typeof event.data === "string") {
      // The Gateway refused the subscription before its first snapshot; the stream has ended.
      current.close();
      ctx.workbenchSource = null;
      const message = errorMessage(parseEvent(event), 503);
      if (ctx.state.service === "ready") setBanner(ctx, failed, "error");
      else patch(ctx, { service: "error", session: { ...ctx.state.session, error: message } });
      return;
    }
    setBanner(ctx, current.readyState === EventSource.CLOSED ? failed : disconnected, "warning");
  };
}

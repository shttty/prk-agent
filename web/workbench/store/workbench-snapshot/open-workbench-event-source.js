import { handleCollectionEvent } from "./handle-collection-event.js";
import { persistCurrentSession } from "../drafts/persist-current-session.js";
import { applyWorkbenchSnapshot } from "./apply-workbench-snapshot.js";
import { restoreSelection } from "./restore-selection.js";
import { parseEvent } from "../../payloads/parse-event.js";
import { selectSession } from "../selection/select-session.js";
import { setError } from "../notices/set-error.js";
import { setBanner } from "../notices/set-banner.js";
import { patch } from "../updates/patch.js";
import { errorMessage } from "../requests/error-message.js";
/** The collection subscription's first snapshot is the workbench base; later snapshots (reconnects) re-base it. */
export function openWorkbenchEventSource(ctx) {
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
        const sessionRow = name && ctx.state.sessions.get(name);
        const recovered = ["closed", "unavailable"].includes(ctx.state.session.snapshot?.state) && sessionRow && !["closed", "closing", "unavailable"].includes(sessionRow.state);
        if (name && recovered) void selectSession(ctx, name);
      } catch (error) { setError(ctx, error instanceof Error ? error.message : "工作台快照格式无效。"); }
    });
    current.addEventListener("collection", (event) => { handleCollectionEvent(ctx, current, event); });
    const disconnected = "会话列表连接已断开，正在重连。";
    const failed = "会话列表连接失败。";
    current.onopen = () => {
      if (ctx.workbenchSource !== current) return;
      patch(ctx, { workbenchLinked: true });
      if ([disconnected, failed].includes(ctx.state.session.banner?.text)) setBanner(ctx, null);
    };
    current.onerror = (event) => {
      if (ctx.workbenchSource !== current) return;
      // Pages waiting on Gateway progress (environment deploys) stop trusting it at once; reconnecting never resumes them.
      patch(ctx, { workbenchLinkLosses: ctx.state.workbenchLinkLosses + 1, workbenchLinked: false });
      if (typeof event.data === "string") {
        // The Gateway refused the subscription before its first snapshot; the stream has ended.
        current.close();
        ctx.workbenchSource = null;
        const message = errorMessage(parseEvent(event), 503);
        if (ctx.state.service === "ready") setBanner(ctx, failed, "error");
        else patch(ctx, { service: "error", session: { ...ctx.state.session, error: message } });
        return;
      }
      setBanner(ctx, current.readyState === 2 ? failed : disconnected, "warning");
    };
  }

import { patchSession } from "../updates/patch-session.js";
import { withPending } from "../updates/with-pending.js";
import { loadNativeCatalog } from "../native-actions/load-native-catalog.js";
import { handleSsePayload } from "./handle-sse-payload.js";
import { parseEvent } from "../../payloads/parse-event.js";
import { hostState } from "../selection/host-state.js";
import { closeEventSource } from "./close-event-source.js";
import { errorMessage } from "../requests/error-message.js";
/**
 * Subscribe to the selected session (read only). Each connection's first snapshot is the base (ORD-5); the first one
 * of this selection also settles what the cached row could not know: a closed session is not watched. A sleeping
 * session stays asleep (watching it starts nothing). A refusal arrives as an `error` frame before any snapshot and ends
 * the stream.
 */
export function openEventSource(ctx, name, token) {
    if (typeof globalThis.EventSource !== "function") {
      patchSession(ctx, { connection: "disconnected", banner: { text: "浏览器不支持实时连接。", tone: "error" } });
      return;
    }
    const current = new EventSource(`${ctx.apiRoot}/sessions/${encodeURIComponent(name)}/events`);
    ctx.source = current;
    const isCurrent = () => token === ctx.selectionToken && ctx.source === current && ctx.state.selectedSessionId === name;
    let based = false;
    let reopened = false;
    current.addEventListener("open", () => {
      if (!isCurrent()) return;
      reopened = based;
      if (based) patchSession(ctx, { connection: "connected", ...(ctx.state.session.banner?.connection ? { banner: null } : {}), pending: withPending(ctx.state.session.pending, "reconnecting", false) });
    });
    const snapshotHandler = (event) => {
      if (!isCurrent()) return;
      const streamId = ctx.state.session.streamId;
      handleSsePayload(ctx, parseEvent(event));
      patchSession(ctx, { connection: "connected", ...(ctx.state.session.banner?.connection ? { banner: null } : {}), pending: withPending(ctx.state.session.pending, "reconnecting", false) });
      // A new stream reloads the catalog while ingesting; a same-stream reconnect may have missed catalog changes.
      if (reopened && streamId === ctx.state.session.streamId) void loadNativeCatalog(ctx, name, token);
      reopened = false;
      if (based) return;
      based = true;
      if (hostState(ctx) === "closed") {
        closeEventSource(ctx);
        patchSession(ctx, { connection: "disconnected", banner: null });
      }
    };
    const hostHandler = (event) => { if (isCurrent()) handleSsePayload(ctx, parseEvent(event)); };
    current.addEventListener("snapshot", snapshotHandler);
    current.addEventListener("host", hostHandler);
    current.addEventListener("terminal", hostHandler);
    current.addEventListener("message_end", hostHandler);
    current.onmessage = hostHandler;
    current.onerror = (event) => {
      if (!isCurrent()) return;
      if (typeof event.data === "string") {
        const body = parseEvent(event);
        closeEventSource(ctx);
        patchSession(ctx, { connection: "disconnected", error: errorMessage(body, 503), banner: { text: "读取会话失败，请重试。", tone: "error", ...(typeof body?.code === "string" ? { code: body.code } : {}) }, pending: withPending(ctx.state.session.pending, "reconnecting", false) });
        return;
      }
      const retrying = current.readyState !== 2;
      patchSession(ctx, { connection: retrying ? "connecting" : "disconnected", banner: { connection: true, text: retrying ? "连接中断，正在重连。" : "连接失败，请重试。", tone: "warning" }, pending: withPending(ctx.state.session.pending, "reconnecting", retrying) });
    };
  }

import { updateSessionRow } from "../workbench-snapshot/update-session-row.js";
import { hostState } from "./host-state.js";
import { reconnect } from "../session-stream/reconnect.js";
import { persistCurrentSession } from "../drafts/persist-current-session.js";
import { patchSession } from "../updates/patch-session.js";
import { withPending } from "../updates/with-pending.js";
import { closeEventSource } from "../session-stream/close-event-source.js";
import { replaceViewQuery } from "./replace-view-query.js";
import { replaceSession } from "../updates/replace-session.js";
import { restoreSession } from "../drafts/restore-session.js";
import { openHistory } from "./open-history.js";
import { loadNativeCatalog } from "../native-actions/load-native-catalog.js";
import { ingestSnapshot } from "../session-stream/ingest-snapshot.js";
import { openEventSource } from "../session-stream/open-event-source.js";
import { flushScroll } from "../drafts/flush-scroll.js";
import { findSessionRow } from "../../payloads/find-session-row.js";
export async function selectSession(ctx, name, { snapshot = null } = {}) {
    const sessionRow = findSessionRow(ctx.state, name);
    if (!sessionRow || ctx.disposed) return false;
    if (sessionRow.done) updateSessionRow(ctx, name, { done: false });
    const reconnectingSameSession = name === ctx.state.selectedSessionId;
    const archived = !ctx.state.sessions.has(name);
    if (reconnectingSameSession && !archived && !snapshot && hostState(ctx) !== "closed") return reconnect(ctx);
    flushScroll(ctx);
    persistCurrentSession(ctx);
    const token = ++ctx.selectionToken;
    patchSession(ctx, { pending: withPending(ctx.state.session.pending, "reconnecting", false) });
    closeEventSource(ctx);
    replaceViewQuery(ctx, name);
    replaceSession(ctx, null, { connection: "connecting" }, { selectedSessionId: name });
    restoreSession(ctx, name);
    ctx.storage.persistSelectedSession(name);
    try {
      if (snapshot) {
        // A provided base (create, recover) is ingested before any subscription, so its catalog is read here.
        ingestSnapshot(ctx, snapshot);
        void loadNativeCatalog(ctx, name, token);
      }
      else if (archived || sessionRow.state === "closed") {
        // One session read; another observer may have recovered it since the cached row, then it is subscribed below.
        const closed = await openHistory(ctx, name, token);
        if (token !== ctx.selectionToken || ctx.state.selectedSessionId !== name || ctx.disposed) return false;
        if (closed) {
          void loadNativeCatalog(ctx, name, token);
          return true;
        }
      }
      if (snapshot && hostState(ctx) === "closed") {
        // Closed sessions resume on their next message.
        patchSession(ctx, { connection: "disconnected", banner: null });
        return true;
      }
      // The subscription's first snapshot is the base. Opening a session only reads it; composing or sending can wake it.
      openEventSource(ctx, name, token);
      return true;
    } catch (error) {
      if (token !== ctx.selectionToken || ctx.state.selectedSessionId !== name) return false;
      patchSession(ctx, { connection: "disconnected", error: error instanceof Error ? error.message : "无法打开执行会话。", banner: { text: "读取会话失败，请重试。", tone: "error" } });
      return false;
    }
  }


import type { StoreContext } from "../store-context-types.ts";
import { updateSessionRow } from "../workbench-snapshot/update-session-row.ts";
import { hostState } from "./host-state.ts";
import { reconnect } from "../session-stream/reconnect.ts";
import { persistCurrentSession } from "../drafts/persist-current-session.ts";
import { patchSession } from "../updates/patch-session.ts";
import { withPending } from "../updates/with-pending.ts";
import { closeEventSource } from "../session-stream/close-event-source.ts";
import { replaceViewQuery } from "./replace-view-query.ts";
import { replaceSession } from "../updates/replace-session.ts";
import { restoreSession } from "../drafts/restore-session.ts";
import { openHistory } from "./open-history.ts";
import { loadNativeCatalog } from "../native-actions/load-native-catalog.ts";
import { ingestSnapshot } from "../session-stream/ingest-snapshot.ts";
import { openEventSource } from "../session-stream/open-event-source.ts";
import { flushScroll } from "../drafts/flush-scroll.ts";
import { findSessionRow } from "../../payloads/find-session-row.ts";

/** Open a session; `snapshot` is a base the caller already holds (create, recover), ingested before any subscription. */
export async function selectSession(ctx: StoreContext, name: string, { snapshot = null }: { snapshot?: unknown } = {}): Promise<boolean> {
  if (!findSessionRow(ctx.state, name) || ctx.disposed) return false;
  const listed = ctx.state.sessions.get(name);
  if (listed?.done) updateSessionRow(ctx, name, { done: false });
  const reconnectingSameSession = name === ctx.state.selectedSessionId;
  const archived = !listed;
  if (reconnectingSameSession && !archived && !snapshot && hostState(ctx) !== "closed") return reconnect(ctx);
  flushScroll(ctx);
  persistCurrentSession(ctx);
  const token = ++ctx.selectionToken;
  patchSession(ctx, { pending: withPending(ctx.state.session.pending, "reconnecting", false) });
  closeEventSource(ctx);
  replaceViewQuery(name);
  replaceSession(ctx, null, { connection: "connecting" }, { selectedSessionId: name });
  restoreSession(ctx, name);
  ctx.storage.persistSelectedSession(name);
  try {
    if (snapshot) {
      // A provided base (create, recover) is ingested before any subscription, so its catalog is read here.
      ingestSnapshot(ctx, snapshot);
      void loadNativeCatalog(ctx, name, token);
    }
    else if (archived || listed.state === "closed") {
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

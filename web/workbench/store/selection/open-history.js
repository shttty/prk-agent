import { getJson } from "../requests/get-json.js";
import { normalizeSnapshot } from "../../payloads/normalize-snapshot.js";
import { normalizeSession } from "../../payloads/normalize-session.js";
import { ingestSnapshot } from "../session-stream/ingest-snapshot.js";
import { patchSession } from "../updates/patch-session.js";
import { patch } from "../updates/patch.js";
/**
 * One read of a session whose row says closed: its history view and its current row. Shows the read-only history and
 * returns true while it is still closed; returns false (row updated) when another observer brought it back.
 */
export async function openHistory(ctx, name, token) {
    const value = await getJson(ctx, `${ctx.apiRoot}/sessions/${encodeURIComponent(name)}/history`);
    if (token !== ctx.selectionToken || ctx.state.selectedSessionId !== name) return true;
    const sessionRow = normalizeSession(value?.session);
    if (sessionRow?.sessionId !== name || value?.readOnly !== true) throw new Error("服务未返回匹配的只读历史。");
    if (sessionRow.state !== "closed") {
      patch(ctx, { sessions: new Map(ctx.state.sessions).set(name, sessionRow) });
      return false;
    }
    const snapshot = normalizeSnapshot(value?.snapshot);
    if (!snapshot || snapshot.state !== "closed") throw new Error("服务未返回匹配的只读历史。");
    ingestSnapshot(ctx, snapshot);
    patchSession(ctx, { connection: "disconnected", transcriptRevision: ctx.state.session.transcriptRevision + 1, banner: null });
    return true;
  }

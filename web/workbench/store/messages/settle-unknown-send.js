import { patch } from "../updates/patch.js";
import { mergeEntry } from "../updates/merge-entry.js";
import { addActivity } from "../notices/add-activity.js";
import { persistCurrentSession } from "../drafts/persist-current-session.js";
/**
 * Apply the Gateway's answer for one unknown send. Delivered: the composer copy goes (if untouched). Refused: it never
 * ran and never will, so its text stays in (or returns to) the composer. Unknown: an earlier Gateway process may have
 * taken it; only the user can decide.
 */
export function settleUnknownSend(ctx, requestId, result) {
  const entry = ctx.state.session.localMessages.get(requestId);
  const status = result?.status;
  if (entry?.status !== "unknown" || !["accepted", "handled", "refused", "unknown"].includes(status)) return;
  if (status === "unknown") {
    patch(ctx, { session: { ...ctx.state.session, localMessages: mergeEntry(ctx, ctx.state.session.localMessages, requestId, { unconfirmable: true }) } });
    persistCurrentSession(ctx);
    return;
  }
  const localMessages = new Map([...ctx.state.session.localMessages].filter(([key]) => key !== requestId));
  const session = { ...ctx.state.session, localMessages, transcriptRevision: ctx.state.session.transcriptRevision + 1 };
  if (status === "refused") {
    const draft = ctx.state.draft.includes(entry.text) ? ctx.state.draft : [ctx.state.draft, entry.text].filter(Boolean).join("\n\n");
    patch(ctx, { draft, session: { ...session, restoredDraft: { count: 1, reason: "undelivered" } } });
  } else {
    const untouched = ctx.state.draft === entry.text;
    patch(ctx, { ...(untouched ? { draft: "", attachments: [], references: [] } : {}), session });
  }
  addActivity(ctx, { title: status === "refused" ? "发送未送达 · 已放回输入框" : "发送已确认送达", time: new Date().toISOString(), meta: requestId, tone: status === "refused" ? "notice" : "" });
  persistCurrentSession(ctx);
}

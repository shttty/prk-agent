import type { StoreContext } from "../store-context-types.ts";
import { patch } from "../updates/patch.ts";
import { persistCurrentSession } from "../drafts/persist-current-session.ts";

/** The user gives up on confirming: drop the unknown receipts and keep their text in the composer. */
export function returnUnknownSends(ctx: StoreContext) {
  const unknown = [...ctx.state.session.localMessages].filter(([, entry]) => entry.status === "unknown");
  if (!unknown.length) return;
  const missing = unknown.map(([, entry]) => entry.text).filter((text) => text && !ctx.state.draft.includes(text));
  const localMessages = new Map([...ctx.state.session.localMessages].filter(([, entry]) => entry.status !== "unknown"));
  patch(ctx, { draft: [ctx.state.draft, ...missing].filter(Boolean).join("\n\n"), session: { ...ctx.state.session, localMessages, transcriptRevision: ctx.state.session.transcriptRevision + 1 } });
  persistCurrentSession(ctx);
}

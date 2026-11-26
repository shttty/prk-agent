import type { StoreContext } from "../store-context-types.ts";
import { patch } from "../updates/patch.ts";
import { persistCurrentSession } from "./persist-current-session.ts";

export function setDraft(ctx: StoreContext, draft: string) {
  patch(ctx, { draft, session: { ...ctx.state.session, ...(draft.trim() ? {} : { restoredDraft: null }) } });
  persistCurrentSession(ctx);
}

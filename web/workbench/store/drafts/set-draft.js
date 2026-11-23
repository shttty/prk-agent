import { patch } from "../updates/patch.js";
import { persistCurrentSession } from "./persist-current-session.js";
export function setDraft(ctx, text) {
    const draft = typeof text === "string" ? text : "";
    patch(ctx, { draft, session: { ...ctx.state.session, ...(draft.trim() ? {} : { restoredDraft: null }) } });
    persistCurrentSession(ctx);
  }


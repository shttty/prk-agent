import type { StoreContext } from "../store-context-types.ts";
import { replaceSession } from "../updates/replace-session.ts";
import { patch } from "../updates/patch.ts";

export function clearSessionState(ctx: StoreContext) {
  replaceSession(ctx);
  patch(ctx, { draft: "", attachments: [], references: [], presentation: null });
}

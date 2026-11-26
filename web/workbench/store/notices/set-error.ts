import type { StoreContext } from "../store-context-types.ts";
import { patchSession } from "../updates/patch-session.ts";

export function setError(ctx: StoreContext, text: string | null) {
  patchSession(ctx, { error: text || null });
}

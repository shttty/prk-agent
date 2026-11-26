import type { StoreContext } from "../store-context-types.ts";
import { patchSession } from "../updates/patch-session.ts";

export function clearNotice(ctx: StoreContext) { patchSession(ctx, { notice: null }); }

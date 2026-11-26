import type { PatchOptions, StoreContext } from "../store-context-types.ts";
import type { SelectedSessionState } from "../store-types.ts";
import { patch } from "./patch.ts";

export function patchSession(ctx: StoreContext, changes: Partial<SelectedSessionState>, options?: PatchOptions) {
  patch(ctx, { session: { ...ctx.state.session, ...changes } }, options);
}

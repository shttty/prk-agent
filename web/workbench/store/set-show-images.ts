import type { StoreContext } from "./store-context-types.ts";
import { patch } from "./updates/patch.ts";

export function setShowImages(ctx: StoreContext, enabled: boolean) {
  patch(ctx, { showImages: enabled });
}

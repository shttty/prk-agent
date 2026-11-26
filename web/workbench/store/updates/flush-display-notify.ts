import type { StoreContext } from "../store-context-types.ts";

export function flushDisplayNotify(ctx: StoreContext) {
  ctx.displayNotifyCancel?.();
  ctx.displayNotifyCancel = null;
}

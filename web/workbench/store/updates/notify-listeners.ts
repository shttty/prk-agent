import type { StoreContext } from "../store-context-types.ts";

export function notifyListeners(ctx: StoreContext) {
  for (const listener of [...ctx.listeners]) listener();
}

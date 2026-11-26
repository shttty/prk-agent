import type { StoreContext } from "../store-context-types.ts";

export function subscribe(ctx: StoreContext, listener: () => void): () => void {
  ctx.listeners.add(listener);
  return () => { ctx.listeners.delete(listener); };
}

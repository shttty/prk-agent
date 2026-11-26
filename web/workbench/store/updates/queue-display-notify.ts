import type { StoreContext } from "../store-context-types.ts";
import { notifyListeners } from "./notify-listeners.ts";

/** Display-only changes notify once per animation frame (a timer where there is no frame). */
export function queueDisplayNotify(ctx: StoreContext) {
  if (ctx.displayNotifyCancel) return;
  if (typeof globalThis.requestAnimationFrame === "function") {
    const id = globalThis.requestAnimationFrame(() => { ctx.displayNotifyCancel = null; notifyListeners(ctx); });
    ctx.displayNotifyCancel = () => globalThis.cancelAnimationFrame(id);
  } else {
    const id = globalThis.setTimeout(() => { ctx.displayNotifyCancel = null; notifyListeners(ctx); }, 0);
    ctx.displayNotifyCancel = () => globalThis.clearTimeout(id);
  }
}

import { notifyListeners } from "./notify-listeners.js";
export function queueDisplayNotify(ctx) {
    if (ctx.displayNotifyCancel) return;
    if (typeof globalThis.requestAnimationFrame === "function") {
      const id = globalThis.requestAnimationFrame(() => { ctx.displayNotifyCancel = null; notifyListeners(ctx); });
      ctx.displayNotifyCancel = () => globalThis.cancelAnimationFrame(id);
    } else {
      const id = globalThis.setTimeout(() => { ctx.displayNotifyCancel = null; notifyListeners(ctx); }, 0);
      ctx.displayNotifyCancel = () => globalThis.clearTimeout(id);
    }
  }


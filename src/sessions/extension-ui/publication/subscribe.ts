import type { UiContext } from "../ui-types.ts";

export function subscribe(ctx: UiContext, listener: () => void): () => void { ctx.listeners.add(listener); return () => ctx.listeners.delete(listener); }

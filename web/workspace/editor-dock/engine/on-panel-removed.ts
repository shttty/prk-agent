import type { EngineContext } from "./engine-types.ts";

export function onPanelRemoved(ctx: EngineContext, listener: (path: string | null) => void) { ctx.removedListeners.add(listener); return () => ctx.removedListeners.delete(listener); }

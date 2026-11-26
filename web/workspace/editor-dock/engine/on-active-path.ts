import type { EngineContext } from "./engine-types.ts";

export function onActivePath(ctx: EngineContext, listener: (path: string | null) => void) { ctx.activeListeners.add(listener); return () => ctx.activeListeners.delete(listener); }

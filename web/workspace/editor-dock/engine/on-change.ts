import type { EngineContext } from "./engine-types.ts";

export function onChange(ctx: EngineContext, listener: (json: string | null) => void) { ctx.changeListeners.add(listener); return () => ctx.changeListeners.delete(listener); }

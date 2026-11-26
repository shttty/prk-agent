import type { EngineContext } from "./engine-types.ts";

export function dispose(ctx: EngineContext) { for (const subscription of ctx.subscriptions) subscription.dispose(); }

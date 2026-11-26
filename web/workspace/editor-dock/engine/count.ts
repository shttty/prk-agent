import type { EngineContext } from "./engine-types.ts";

export const count = (ctx: EngineContext) => ctx.api.panels.length;

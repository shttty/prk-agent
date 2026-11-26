import type { EngineContext } from "./engine-types.ts";

export const paths = (ctx: EngineContext) => ctx.panels().map((panel) => panel.path);

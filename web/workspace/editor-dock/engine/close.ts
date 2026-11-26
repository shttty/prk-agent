import type { EngineContext } from "./engine-types.ts";

export function close(ctx: EngineContext, id: string) { ctx.api.getPanel(id)?.api.close(); }

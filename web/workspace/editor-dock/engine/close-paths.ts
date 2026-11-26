import type { EngineContext } from "./engine-types.ts";
import { panelsWithin } from "../../editor-layout/panels-within.ts";

export function closePaths(ctx: EngineContext, gone: string) { for (const id of panelsWithin(ctx.panels(), gone)) ctx.close(id); }

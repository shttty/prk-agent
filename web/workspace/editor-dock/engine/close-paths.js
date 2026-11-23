import { panelsWithin } from "../../editor-layout/panels-within.js";
export function closePaths(ctx, gone) { for (const id of panelsWithin(ctx.panels(), gone)) ctx.engine.close(id); }

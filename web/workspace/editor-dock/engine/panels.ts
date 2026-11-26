import type { EngineContext } from "./engine-types.ts";
import { FILE_COMPONENT } from "../../editor-layout/editor-layout-constants.ts";

export const panels = (ctx: EngineContext) => ctx.panelsOf(FILE_COMPONENT);

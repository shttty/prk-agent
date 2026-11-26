import type { EngineContext } from "./engine-types.ts";
import { FILE_COMPONENT } from "../../editor-layout/editor-layout-constants.ts";
import { paramString } from "./param-string.ts";

export const activePath = (ctx: EngineContext) => (ctx.api.activePanel?.api.component === FILE_COMPONENT ? paramString(ctx.api.activePanel.params, "path") : null);

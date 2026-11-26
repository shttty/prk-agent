import type { EngineContext } from "./engine-types.ts";
import { TERMINAL_COMPONENT } from "../../editor-layout/editor-layout-constants.ts";
import { paramString } from "./param-string.ts";

export const terminalNames = (ctx: EngineContext) => ctx.api.panels.filter((panel) => panel.api.component === TERMINAL_COMPONENT).flatMap((panel) => paramString(panel.params, "name") ?? []);

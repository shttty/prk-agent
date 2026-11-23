import { TERMINAL_COMPONENT } from "../../editor-layout/editor-layout-constants.js";

export const terminalNames = (ctx) => ctx.api.panels.filter((panel) => panel.api.component === TERMINAL_COMPONENT).map((panel) => panel.params?.name);

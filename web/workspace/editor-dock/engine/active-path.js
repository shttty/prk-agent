import { FILE_COMPONENT } from "../../editor-layout/editor-layout-constants.js";
export const activePath = (ctx) => (ctx.api.activePanel?.api.component === FILE_COMPONENT ? ctx.api.activePanel.params?.path ?? null : null);

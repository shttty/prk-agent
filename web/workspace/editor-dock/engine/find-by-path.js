import { findPanelByPath } from "../../editor-layout/find-panel-by-path.js";
export const findByPath = (ctx, path) => findPanelByPath(ctx.panels(), path);

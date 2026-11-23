import { FILE_COMPONENT } from "./editor-layout-constants.js";
export const savedPaths = (dockview) => Object.values(dockview.panels).filter((panel) => panel.contentComponent === FILE_COMPONENT).map((panel) => panel.params.path);

import type { SerializedDockview } from "dockview-react";
import { FILE_COMPONENT } from "./editor-layout-constants.ts";

export const savedPaths = (dockview: SerializedDockview) => Object.values(dockview.panels).filter((panel) => panel.contentComponent === FILE_COMPONENT).flatMap((panel) => (typeof panel.params?.path === "string" ? [panel.params.path] : []));

import { findPanelByPath } from "../../editor-layout/find-panel-by-path.js";
import { placementFor } from "../../editor-layout/placement-for.js";
import { fileGroupIds } from "./file-group-ids.js";
import { newPanelId } from "../../editor-layout/new-panel-id.js";
import { FILE_COMPONENT } from "../../editor-layout/editor-layout-constants.js";
import { baseName } from "../../file-paths/base-name.js";
export function openFile(ctx, path) {
      const existing = findPanelByPath(ctx.panels(), path);
      if (existing) { ctx.api.getPanel(existing).api.setActive(); return existing; }
      const placement = placementFor(fileGroupIds(ctx), ctx.api.activeGroup?.id);
      const id = newPanelId();
      ctx.api.addPanel({ id, component: FILE_COMPONENT, tabComponent: FILE_COMPONENT, title: baseName(path), params: { path }, ...(placement ? { position: placement } : {}) });
      return id;
    }

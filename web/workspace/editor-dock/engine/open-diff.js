import { findPanelByPath } from "../../editor-layout/find-panel-by-path.js";
import { DIFF_COMPONENT } from "../../editor-layout/editor-layout-constants.js";
import { placementFor } from "../../editor-layout/placement-for.js";
import { fileGroupIds } from "./file-group-ids.js";
import { newPanelId } from "../../editor-layout/new-panel-id.js";
import { baseName } from "../../file-paths/base-name.js";
export function openDiff(ctx, path) {
      const existing = findPanelByPath(ctx.panelsOf(DIFF_COMPONENT), path);
      if (existing) { ctx.api.getPanel(existing).api.setActive(); return existing; }
      const placement = placementFor(fileGroupIds(ctx), ctx.api.activeGroup?.id);
      const id = newPanelId();
      ctx.api.addPanel({ id, component: DIFF_COMPONENT, tabComponent: DIFF_COMPONENT, title: baseName(path), params: { path }, ...(placement ? { position: placement } : {}) });
      return id;
    }

import { findPanelByPath } from "../../editor-layout/find-panel-by-path.ts";
import { DIFF_COMPONENT } from "../../editor-layout/editor-layout-constants.ts";
import { placementFor } from "../../editor-layout/placement-for.ts";
import { fileGroupIds } from "./file-group-ids.ts";
import { newPanelId } from "../../editor-layout/new-panel-id.ts";
import { baseName } from "../../file-paths/base-name.ts";
import type { EngineContext } from "./engine-types.ts";

export function openDiff(ctx: EngineContext, path: string) {
  const existing = findPanelByPath(ctx.panelsOf(DIFF_COMPONENT), path);
  if (existing) { ctx.api.getPanel(existing)?.api.setActive(); return existing; }
  const placement = placementFor(fileGroupIds(ctx), ctx.api.activeGroup?.id);
  const id = newPanelId();
  ctx.api.addPanel({ id, component: DIFF_COMPONENT, tabComponent: DIFF_COMPONENT, title: baseName(path), params: { path }, ...(placement ? { position: placement } : {}) });
  return id;
}

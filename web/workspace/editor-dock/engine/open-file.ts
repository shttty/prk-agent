import { findPanelByPath } from "../../editor-layout/find-panel-by-path.ts";
import { FILE_COMPONENT } from "../../editor-layout/editor-layout-constants.ts";
import { placementFor } from "../../editor-layout/placement-for.ts";
import { fileGroupIds } from "./file-group-ids.ts";
import { newPanelId } from "../../editor-layout/new-panel-id.ts";
import { baseName } from "../../file-paths/base-name.ts";
import type { EngineContext } from "./engine-types.ts";

export function openFile(ctx: EngineContext, path: string) {
  const existing = findPanelByPath(ctx.panels(), path);
  if (existing) { ctx.api.getPanel(existing)?.api.setActive(); return existing; }
  const placement = placementFor(fileGroupIds(ctx), ctx.api.activeGroup?.id);
  const id = newPanelId();
  ctx.api.addPanel({ id, component: FILE_COMPONENT, tabComponent: FILE_COMPONENT, title: baseName(path), params: { path }, ...(placement ? { position: placement } : {}) });
  return id;
}

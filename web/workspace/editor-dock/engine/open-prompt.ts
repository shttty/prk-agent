import { PROMPT_COMPONENT } from "../../editor-layout/editor-layout-constants.ts";
import { PROMPT_PANEL_ID } from "../../editor-layout/editor-layout-constants.ts";
import { placementFor } from "../../editor-layout/placement-for.ts";
import { fileGroupIds } from "./file-group-ids.ts";
import type { EngineContext } from "./engine-types.ts";

/** Show the prompt viewer: its one tab joins the group file and diff tabs use, or is brought forward. */
export function openPrompt(ctx: EngineContext) {
  const existing = ctx.api.getPanel(PROMPT_PANEL_ID);
  if (existing) { existing.api.setActive(); return; }
  const placement = placementFor(fileGroupIds(ctx), ctx.api.activeGroup?.id);
  ctx.api.addPanel({ id: PROMPT_PANEL_ID, component: PROMPT_COMPONENT, tabComponent: PROMPT_COMPONENT, title: "提示词", ...(placement ? { position: placement } : {}) });
}

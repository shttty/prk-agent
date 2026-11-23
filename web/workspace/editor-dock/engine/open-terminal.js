import { TERMINAL_COMPONENT } from "../../editor-layout/editor-layout-constants.js";
import { TERMINAL_RENDERER } from "../../editor-layout/editor-layout-constants.js";
import { terminalPanelId } from "../../editor-layout/terminal-panel-id.js";
import { placementFor } from "../../editor-layout/placement-for.js";

/** Make sure shell `name` has its tab (joining the active group). `focus`: it becomes the shown tab, an existing one is
 * activated; otherwise a new tab opens in the background (unless the dock is empty). Returns whether it is now the
 * shown tab because of this call. */
export function openTerminal(ctx, name, focus) {
  const existing = ctx.api.getPanel(terminalPanelId(name));
  if (existing) {
    if (focus) existing.api.setActive();
    return Boolean(focus);
  }
  const placement = placementFor(ctx.api.groups.map((group) => group.id), ctx.api.activeGroup?.id);
  const background = !focus && ctx.api.panels.length > 0;
  ctx.api.addPanel({ id: terminalPanelId(name), component: TERMINAL_COMPONENT, tabComponent: TERMINAL_COMPONENT, title: name, params: { name }, renderer: TERMINAL_RENDERER, inactive: background, ...(placement ? { position: placement } : {}) });
  return !background;
}

import { isRecord } from "./is-record.js";
import { leaves } from "./leaves.js";
import { FILE_COMPONENT } from "./editor-layout-constants.js";
import { DIFF_COMPONENT } from "./editor-layout-constants.js";
import { TERMINAL_COMPONENT } from "./editor-layout-constants.js";
import { TERMINAL_RENDERER } from "./editor-layout-constants.js";
import { terminalPanelId } from "./terminal-panel-id.js";
/** A dock layout this module wrote, or null. `hosted`: panels the host page put in the grid itself (`{ id: component }`,
 * e.g. the desktop stage's chat), taken as they are. */
export function parseSavedLayout(raw, hosted = {}) {
  let saved;
  try { saved = JSON.parse(raw); } catch { return null; }
  if (!isRecord(saved) || !isRecord(saved.grid) || !isRecord(saved.panels)) return null;
  const groups = leaves(saved.grid.root);
  const ids = Object.keys(saved.panels);
  if (!groups || !groups.length || !ids.length) return null;
  const seen = new Set();
  const panels = {};
  for (const id of ids) {
    const panel = saved.panels[id];
    const component = panel?.contentComponent;
    if (!isRecord(panel) || panel.id !== id) return null;
    if (Object.hasOwn(hosted, id)) {
      if (component !== hosted[id]) return null;
      panels[id] = panel;
      continue;
    }
    if (component === TERMINAL_COMPONENT) {
      // One panel per shell, keyed by its name; a saved layout's own renderer is not trusted (see TERMINAL_RENDERER).
      const name = panel.params?.name;
      if (typeof name !== "string" || !name || id !== terminalPanelId(name)) return null;
      panels[id] = { ...panel, renderer: TERMINAL_RENDERER };
      continue;
    }
    const path = panel.params?.path;
    // One tab per file and one per file's diff.
    if ((component !== FILE_COMPONENT && component !== DIFF_COMPONENT) || typeof path !== "string" || !path || seen.has(`${component}:${path}`)) return null;
    seen.add(`${component}:${path}`);
    panels[id] = panel;
  }
  const placed = new Set();
  for (const group of groups) {
    if (!Array.isArray(group.views) || !group.views.length || typeof group.id !== "string") return null;
    if (group.activeView !== undefined && !group.views.includes(group.activeView)) return null;
    for (const view of group.views) {
      if (!(view in panels) || placed.has(view)) return null;
      placed.add(view);
    }
  }
  if (placed.size !== ids.length) return null;
  // Only the grid is kept: floating/popout/edge groups are not part of this editor.
  return { grid: saved.grid, panels, ...(typeof saved.activeGroup === "string" ? { activeGroup: saved.activeGroup } : {}) };
}

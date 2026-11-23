import { parseSavedLayout } from "./parse-saved-layout.js";
import { leaves } from "./leaves.js";
import { serializeLayout } from "./serialize-layout.js";
export function mergeSavedLayout(raw) {
  const layout = parseSavedLayout(raw);
  if (!layout) return null;
  const groups = leaves(layout.grid.root);
  const active = groups.find((group) => group.id === layout.activeGroup) ?? groups[0];
  const first = groups[0];
  const data = { ...first, views: groups.flatMap((group) => group.views), activeView: active.activeView ?? active.views[0] };
  const root = { type: "branch", data: [{ type: "leaf", data, size: layout.grid.width }], size: layout.grid.height };
  return serializeLayout({ grid: { ...layout.grid, orientation: "HORIZONTAL", root }, panels: layout.panels, activeGroup: first.id });
}

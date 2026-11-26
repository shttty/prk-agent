import { Orientation } from "dockview-react";
import { parseSavedLayout } from "./parse-saved-layout.ts";
import { leaves } from "./leaves.ts";
import { serializeLayout } from "./serialize-layout.ts";

export function mergeSavedLayout(raw: string) {
  const layout = parseSavedLayout(raw);
  if (!layout) return null;
  const groups = leaves(layout.grid.root) ?? [];
  const first = groups[0];
  if (!first) return null;
  const active = groups.find((group) => group.id === layout.activeGroup) ?? first;
  const data = { ...first, views: groups.flatMap((group) => group.views), activeView: active.activeView ?? active.views[0] };
  const root = { type: "branch" as const, data: [{ type: "leaf" as const, data, size: layout.grid.width }], size: layout.grid.height };
  return serializeLayout({ grid: { ...layout.grid, orientation: Orientation.HORIZONTAL, root }, panels: layout.panels, activeGroup: first.id });
}

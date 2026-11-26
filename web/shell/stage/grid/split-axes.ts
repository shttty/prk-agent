import type { SavedGroup } from "../../../workspace/editor-layout/editor-layout-types.ts";
import type { GridNode, StageGrid } from "./grid-types.ts";

const holds = (node: GridNode, isAnchor: (group: SavedGroup) => boolean): boolean => (node.type === "leaf" ? isAnchor(node.data) : node.data.some((child) => holds(child, isAnchor)));

const leafIds = (node: GridNode): string[] => (node.type === "leaf" ? [node.data.id] : node.data.flatMap(leafIds));

/** For every other group of a serialized dockview grid (`{ root, orientation }`), the axis of the split that separates it
 * from the anchor group (`isAnchor(group data)`, the main area): "x" when they sit side by side (it keeps its width),
 * "y" when one is above the other (it keeps its height). That split is the deepest branch holding both; a branch lays
 * its children out along its orientation, which alternates with depth from the grid's own. Returns a Map of group
 * id -> axis. */
export function splitAxes(grid: Pick<StageGrid, "root" | "orientation">, isAnchor: (group: SavedGroup) => boolean) {
  const axes = new Map<string, "x" | "y">();
  const walk = (node: GridNode, horizontal: boolean) => {
    if (node.type === "leaf") return;
    for (const child of node.data) walk(child, !horizontal);
    if (!holds(node, isAnchor)) return;
    for (const child of node.data) {
      if (holds(child, isAnchor)) continue;
      for (const id of leafIds(child)) if (!axes.has(id)) axes.set(id, horizontal ? "x" : "y");
    }
  };
  walk(grid.root, grid.orientation !== "VERTICAL");
  return axes;
}

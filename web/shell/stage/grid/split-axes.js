const holds = (node, isAnchor) => (node.type === "leaf" ? isAnchor(node.data) : node.data.some((child) => holds(child, isAnchor)));

const leafIds = (node) => (node.type === "leaf" ? [node.data.id] : node.data.flatMap(leafIds));

/** For every other group of a serialized dockview grid (`{ root, orientation }`), the axis of the split that separates it
 * from the anchor group (`isAnchor(group data)`, the main area): "x" when they sit side by side (it keeps its width),
 * "y" when one is above the other (it keeps its height). That split is the deepest branch holding both; a branch lays
 * its children out along its orientation, which alternates with depth from the grid's own. Returns a Map of group
 * id -> axis. */
export function splitAxes(grid, isAnchor) {
  const axes = new Map();
  const walk = (node, horizontal) => {
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

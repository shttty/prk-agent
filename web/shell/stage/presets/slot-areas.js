/** Area of every leaf of a fitted grid, keyed by the leaf's `data.slot`. */
export function slotAreas(grid) {
  const areas = new Map();
  const walk = (node, length, breadth) => {
    // `length`: extent along the parent's direction (the node's size), `breadth`: across it.
    if (node.type === "leaf") { areas.set(node.data.slot, length * breadth); return; }
    for (const child of node.data) walk(child, child.size, length);
  };
  for (const child of grid.root.data) walk(child, child.size, grid.root.size);
  return areas;
}

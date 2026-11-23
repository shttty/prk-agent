/** Width and height of every group of a serialized dockview grid (`{ root, width, height, orientation }`), from the
 * node sizes: a node's `size` runs along its parent's orientation, the other dimension is its parent's. Returns an
 * object of group id -> `{ width, height }`. */
export function leafExtents(grid) {
  const out = {};
  const walk = (node, width, height, horizontal) => {
    if (node.type === "leaf") { out[node.data.id] = { width, height }; return; }
    for (const child of node.data) walk(child, horizontal ? child.size : width, horizontal ? height : child.size, !horizontal);
  };
  walk(grid.root, grid.width, grid.height, grid.orientation !== "VERTICAL");
  return out;
}

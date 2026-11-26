import type { Extents, GridNode, StageGrid } from "./grid-types.ts";

/** Width and height of every group of a serialized dockview grid (`{ root, width, height, orientation }`), from the
 * node sizes: a node's `size` runs along its parent's orientation, the other dimension is its parent's. Returns an
 * object of group id -> `{ width, height }`. */
export function leafExtents(grid: Pick<StageGrid, "root" | "width" | "height" | "orientation">) {
  const out: Extents = {};
  const walk = (node: GridNode, width: number, height: number, horizontal: boolean) => {
    if (node.type === "leaf") { out[node.data.id] = { width, height }; return; }
    for (const child of node.data) walk(child, horizontal ? child.size ?? 0 : width, horizontal ? height : child.size ?? 0, !horizontal);
  };
  walk(grid.root, grid.width, grid.height, grid.orientation !== "VERTICAL");
  return out;
}

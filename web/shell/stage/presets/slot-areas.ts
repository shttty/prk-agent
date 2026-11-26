import type { GridNode, StageGrid } from "../grid/grid-types.ts";
import type { Slot } from "./preset-types.ts";

/** Area of every leaf of a fitted grid, keyed by the leaf's `data.slot`. */
export function slotAreas(grid: StageGrid<Slot>) {
  const areas = new Map<number, number>();
  const walk = (node: GridNode<Slot>, length: number, breadth: number) => {
    // `length`: extent along the parent's direction (the node's size), `breadth`: across it.
    if (node.type === "leaf") { areas.set(node.data.slot, length * breadth); return; }
    for (const child of node.data) walk(child, child.size ?? 0, length);
  };
  if (grid.root.type === "branch") for (const child of grid.root.data) walk(child, child.size ?? 0, grid.root.size ?? 0);
  return areas;
}

import type { Extents, GridLeaf, GridNode, StageGrid } from "./grid-types.ts";

const firstLeaf = (node: GridNode): GridLeaf => {
  if (node.type === "leaf") return node;
  const first = node.data[0];
  if (!first) throw new Error("A grid branch has no children.");
  return firstLeaf(first);
};

/** A serialized grid whose node sizes are the groups' preferred sizes (`preferred`: group id -> `{ width, height }`)
 * along each node's parent orientation; a branch takes its first group's (its groups share that extent). Nodes without
 * a preferred size keep theirs. Pure. */
export function withPreferred(grid: StageGrid, preferred: Extents): StageGrid {
  const node = (from: GridNode, horizontal: boolean): GridNode => {
    const wanted = preferred[firstLeaf(from).data.id]?.[horizontal ? "width" : "height"];
    const size = wanted !== undefined && Number.isFinite(wanted) ? wanted : from.size;
    return from.type === "leaf" ? { ...from, size } : { ...from, size, data: from.data.map((child) => node(child, !horizontal)) };
  };
  const horizontal = grid.orientation !== "VERTICAL";
  return { ...grid, root: grid.root.type === "leaf" ? grid.root : { ...grid.root, data: grid.root.data.map((child) => node(child, horizontal)) } };
}

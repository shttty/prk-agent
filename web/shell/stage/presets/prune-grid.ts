import { Orientation } from "dockview-react";
import type { GridLeaf, GridNode, StageGrid } from "../grid/grid-types.ts";

/** The nodes that replace `node` in its parent once the groups `keep(leaf)` rejects are gone: none, itself, or (a branch
 * left with one branch child) that child's children, which run along the parent's direction. */
function prune<L>(node: GridNode<L>, keep: (leaf: GridLeaf<L>) => boolean): GridNode<L>[] {
  if (node.type === "leaf") return keep(node) ? [node] : [];
  const kids = node.data.flatMap((child) => prune(child, keep));
  const [only] = kids;
  if (!only) return [];
  if (kids.length > 1) return [{ ...node, data: kids }];
  return only.type === "leaf" ? [{ ...only, size: node.size }] : only.data;
}

/** A split tree (`{ orientation, root }`) without the leaves `keep` rejects and without branches of one child (sizes
 * are fitted afterwards). The root stays a branch; a root left with one branch child is replaced by it, which flips
 * the orientation. */
export function pruneGrid<L>(grid: StageGrid<L>, keep: (leaf: GridLeaf<L>) => boolean): StageGrid<L> {
  if (grid.root.type === "leaf") return grid;
  const kids = grid.root.data.flatMap((child) => prune(child, keep));
  const [only] = kids;
  if (kids.length === 1 && only?.type === "branch") {
    return { ...grid, orientation: grid.orientation === "VERTICAL" ? Orientation.HORIZONTAL : Orientation.VERTICAL, root: { ...only, size: grid.root.size } };
  }
  return { ...grid, root: { ...grid.root, data: kids } };
}

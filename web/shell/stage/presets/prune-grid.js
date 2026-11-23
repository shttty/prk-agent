/** The nodes that replace `node` in its parent once the groups `keep(leaf)` rejects are gone: none, itself, or (a branch
 * left with one branch child) that child's children, which run along the parent's direction. */
function prune(node, keep) {
  if (node.type === "leaf") return keep(node) ? [node] : [];
  const kids = node.data.flatMap((child) => prune(child, keep));
  if (!kids.length) return [];
  if (kids.length > 1) return [{ ...node, data: kids }];
  const [only] = kids;
  return only.type === "leaf" ? [{ ...only, size: node.size }] : only.data;
}

/** A split tree (`{ orientation, root }`) without the leaves `keep` rejects and without branches of one child (sizes
 * are fitted afterwards). The root stays a branch; a root left with one branch child is replaced by it, which flips
 * the orientation. */
export function pruneGrid(grid, keep) {
  const kids = grid.root.data.flatMap((child) => prune(child, keep));
  if (kids.length === 1 && kids[0].type === "branch") {
    return { ...grid, orientation: grid.orientation === "VERTICAL" ? "HORIZONTAL" : "VERTICAL", root: { ...kids[0], size: grid.root.size } };
  }
  return { ...grid, root: { ...grid.root, data: kids } };
}

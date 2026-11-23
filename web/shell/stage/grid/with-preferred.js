const firstLeaf = (node) => (node.type === "leaf" ? node : firstLeaf(node.data[0]));

/** A serialized grid whose node sizes are the groups' preferred sizes (`preferred`: group id -> `{ width, height }`)
 * along each node's parent orientation; a branch takes its first group's (its groups share that extent). Nodes without
 * a preferred size keep theirs. Pure. */
export function withPreferred(grid, preferred) {
  const node = (from, horizontal) => {
    const wanted = preferred[firstLeaf(from).data.id]?.[horizontal ? "width" : "height"];
    const size = Number.isFinite(wanted) ? wanted : from.size;
    return from.type === "leaf" ? { ...from, size } : { ...from, size, data: from.data.map((child) => node(child, !horizontal)) };
  };
  const horizontal = grid.orientation !== "VERTICAL";
  return { ...grid, root: { ...grid.root, data: grid.root.data.map((child) => node(child, horizontal)) } };
}

/** The sizes a layout asks of each of its groups, by slot (tree order, as planSlots numbers them): `{ width?, height? }`
 * from the nearest node on the group's path that sets a size in that direction (a node's size runs along its parent's
 * orientation; open sizes ask nothing). Returns a Map slot -> sizes. */
export function askedSizes(layout) {
  const out = new Map();
  let slot = 0;
  const walk = (node, horizontal, inherited) => {
    const asked = node.size == null ? inherited : { ...inherited, [horizontal ? "width" : "height"]: node.size };
    if (node.type === "leaf") { out.set(slot++, asked); return; }
    for (const child of node.data) walk(child, !horizontal, asked);
  };
  const horizontal = layout.orientation !== "VERTICAL";
  for (const child of layout.root.data) walk(child, horizontal, {});
  return out;
}

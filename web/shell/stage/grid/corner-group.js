/** Id of the group in the top-right corner of a serialized dockview grid (`{ root, orientation }`): along a row the
 * last shown child, down a column the first, each level turning the orientation. */
export function cornerGroup(grid) {
  let node = grid.root;
  let row = grid.orientation !== "VERTICAL";
  while (node.type !== "leaf") {
    const shown = node.data.filter((child) => child.visible !== false);
    node = row ? shown.at(-1) : shown[0];
    row = !row;
  }
  return node.data.id;
}

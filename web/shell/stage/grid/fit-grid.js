import { CHAT_VIEW_MIN } from "./stage-constants.js";
import { GROUP_LIMITS } from "./stage-constants.js";

const holds = (node, test) => (node.type === "leaf" ? test(node.data) : node.data.some((child) => holds(child, test)));

const total = (sizes) => sizes.reduce((sum, size) => sum + size, 0);

/** `sizes` scaled to sum to `length` (the last one takes the rounding). */
function scale(sizes, length) {
  const sum = total(sizes);
  const out = sizes.map((size) => (sum > 0 ? Math.floor((size * length) / sum) : Math.floor(length / sizes.length)));
  out[out.length - 1] += length - total(out);
  return out;
}

/** Sizes of a branch's children along it, summing to `length`. One child absorbs the difference: one whose size is
 * left open (`null`), else the one holding the main area; the others keep theirs (shrinking together only when the
 * absorber would fall under its floor, the chat card's when it holds the chat). Without an absorber they scale
 * together. */
function share(children, length, horizontal, { isMain, isChat }) {
  const sizes = children.map((child) => Math.max(0, Math.round(child.size ?? 0)));
  let absorber = children.findIndex((child) => child.size == null);
  if (absorber < 0) absorber = children.findIndex((child) => holds(child, isMain));
  if (absorber < 0) return scale(sizes, length);
  const chat = holds(children[absorber], isChat);
  const floor = Math.min(length, chat ? (horizontal ? CHAT_VIEW_MIN.width : CHAT_VIEW_MIN.height) : (horizontal ? GROUP_LIMITS.minimumWidth : GROUP_LIMITS.minimumHeight));
  const others = sizes.filter((_, index) => index !== absorber);
  const room = length - total(others);
  if (room >= floor || !others.length) { sizes[absorber] = room; return sizes; }
  const shrunk = scale(others, length - floor);
  return sizes.map((_, index) => (index === absorber ? floor : shrunk[index < absorber ? index : index - 1]));
}

function fitBranch(branch, length, breadth, horizontal, tests) {
  const sizes = share(branch.data, length, horizontal, tests);
  return {
    ...branch,
    size: breadth,
    data: branch.data.map((child, index) => (child.type === "leaf" ? { ...child, size: sizes[index] } : fitBranch(child, breadth, sizes[index], !horizontal, tests))),
  };
}

/** A serialized dockview grid (`{ root, width, height, orientation }`) with its sizes fitted to `width` x `height`: the
 * groups keep their sizes and the main area's side of every split takes the difference (see `share`). `isMain(group)`
 * and `isChat(group)` tell the main area's and the chat's group from a leaf's `data`. Pure: the input is not changed. */
export function fitGrid(grid, width, height, tests) {
  const horizontal = grid.orientation !== "VERTICAL";
  return { ...grid, width, height, root: fitBranch(grid.root, horizontal ? width : height, horizontal ? height : width, horizontal, tests) };
}

import type { GridBranch, GridNode, GridTests, StageGrid } from "./grid-types.ts";
import { CHAT_VIEW_MIN } from "./stage-constants.ts";
import { GROUP_LIMITS } from "./stage-constants.ts";

const holds = <L>(node: GridNode<L>, test: (group: L) => boolean): boolean => (node.type === "leaf" ? test(node.data) : node.data.some((child) => holds(child, test)));

const total = (sizes: readonly number[]) => sizes.reduce((sum, size) => sum + size, 0);

/** `sizes` scaled to sum to `length` (the last one takes the rounding). */
function scale(sizes: readonly number[], length: number) {
  const sum = total(sizes);
  const out = sizes.map((size) => (sum > 0 ? Math.floor((size * length) / sum) : Math.floor(length / sizes.length)));
  out[out.length - 1] = (out[out.length - 1] ?? 0) + length - total(out);
  return out;
}

/** Sizes of a branch's children along it, summing to `length`. One child absorbs the difference: one whose size is
 * left open (`null`), else the one holding the main area; the others keep theirs (shrinking together only when the
 * absorber would fall under its floor, the chat card's when it holds the chat). Without an absorber they scale
 * together. */
function share<L>(children: GridNode<L>[], length: number, horizontal: boolean, { isMain, isChat }: GridTests<L>) {
  const sizes = children.map((child) => Math.max(0, Math.round(child.size ?? 0)));
  let absorber = children.findIndex((child) => child.size == null);
  if (absorber < 0) absorber = children.findIndex((child) => holds(child, isMain));
  const absorbing = children[absorber];
  if (!absorbing) return scale(sizes, length);
  const chat = holds(absorbing, isChat);
  const floor = Math.min(length, chat ? (horizontal ? CHAT_VIEW_MIN.width : CHAT_VIEW_MIN.height) : (horizontal ? GROUP_LIMITS.minimumWidth : GROUP_LIMITS.minimumHeight));
  const others = sizes.filter((_, index) => index !== absorber);
  const room = length - total(others);
  if (room >= floor || !others.length) { sizes[absorber] = room; return sizes; }
  const shrunk = scale(others, length - floor);
  return sizes.map((_, index) => (index === absorber ? floor : shrunk[index < absorber ? index : index - 1] ?? 0));
}

function fitBranch<L>(branch: GridBranch<L>, length: number, breadth: number, horizontal: boolean, tests: GridTests<L>): GridBranch<L> {
  const sizes = share(branch.data, length, horizontal, tests);
  return {
    ...branch,
    size: breadth,
    data: branch.data.map((child, index): GridNode<L> => (child.type === "leaf" ? { ...child, size: sizes[index] } : fitBranch(child, breadth, sizes[index] ?? 0, !horizontal, tests))),
  };
}

/** A serialized dockview grid (`{ root, width, height, orientation }`) with its sizes fitted to `width` x `height`: the
 * groups keep their sizes and the main area's side of every split takes the difference (see `share`). `isMain(group)`
 * and `isChat(group)` tell the main area's and the chat's group from a leaf's `data`. Pure: the input is not changed. */
export function fitGrid<L>(grid: StageGrid<L>, width: number, height: number, tests: GridTests<L>): StageGrid<L> {
  const horizontal = grid.orientation !== "VERTICAL";
  const root = grid.root.type === "leaf" ? grid.root : fitBranch(grid.root, horizontal ? width : height, horizontal ? height : width, horizontal, tests);
  return { ...grid, width, height, root };
}

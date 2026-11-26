import type { GridNode, StageGrid } from "../grid/grid-types.ts";
import type { Preset, PresetNode, Slot } from "./preset-types.ts";
import { fitGrid } from "../grid/fit-grid.ts";
import { isChatSlot } from "./preset-kinds.ts";

const isMainSlot = (data: Slot) => data.main;

/** A layout's split tree as a grid fitted to `width` x `height`, each leaf's data `{ kinds, main, slot }` (slot: its
 * index in tree order). The main area absorbs (the chat when no group is marked). */
export function planSlots(layout: Preset, width: number, height: number): StageGrid<Slot> {
  let slot = 0;
  const node = (from: PresetNode): GridNode<Slot> => (from.type === "leaf"
    ? { type: "leaf", size: from.size ?? undefined, data: { kinds: from.kinds, main: from.main === true, slot: slot++ } }
    : { type: "branch", size: from.size ?? undefined, data: from.data.map(node) });
  const root = node(layout.root);
  const marked = JSON.stringify(root).includes('"main":true');
  return fitGrid({ orientation: layout.orientation, root, width, height }, width, height, { isMain: marked ? isMainSlot : isChatSlot, isChat: isChatSlot });
}

import { fitGrid } from "../grid/fit-grid.js";
import { isChatSlot } from "./preset-kinds.js";

const isMainSlot = (data) => data?.main === true;

/** A layout's split tree as a grid fitted to `width` x `height`, each leaf's data `{ kinds, main, slot }` (slot: its
 * index in tree order). The main area absorbs (the chat when no group is marked). */
export function planSlots(layout, width, height) {
  let slot = 0;
  const node = (from) => (from.type === "leaf" ? { type: "leaf", size: from.size, data: { kinds: from.kinds, main: from.main === true, slot: slot++ } } : { ...from, data: from.data.map(node) });
  const root = node(layout.root);
  const marked = JSON.stringify(root).includes('"main":true');
  return fitGrid({ orientation: layout.orientation, root }, width, height, { isMain: marked ? isMainSlot : isChatSlot, isChat: isChatSlot });
}

import { isChatSlot } from "./preset-kinds.js";
import { planSlots } from "./plan-slots.js";
import { slotAreas } from "./slot-areas.js";
import { slotLeaves } from "./slot-leaves.js";

/** Index path from `node` down to the leaf `test` picks, or null. */
function pathTo(node, test) {
  if (node.type === "leaf") return test(node.data) ? [] : null;
  for (const [index, child] of node.data.entries()) { const rest = pathTo(child, test); if (rest) return [index, ...rest]; }
  return null;
}

/** Where a new `kind` ("files" | "terminal") tab goes under the last applied `layout`. Its group there is the first one
 * taking that kind, else the layout's largest workspace group. A live workspace group that can be it (it already holds
 * that kind, or only kinds that group takes) gets the tab: one already holding that kind first, the active one first. Otherwise a new group opens beside
 * the chat on that group's side, at that group's size (the side's extent where the group shares it with others).
 * `live`: `{ chat, active, groups: [{ id, kinds }] }`; `size`: the stage's `{ width, height }`. Returns dockview addPanel
 * position options. */
export function placeByPreset(layout, kind, live, size) {
  const plan = planSlots(layout, size.width, size.height);
  const slots = slotLeaves(plan.root).filter((leaf) => !isChatSlot(leaf.data));
  const areas = slotAreas(plan);
  const target = slots.find((leaf) => leaf.data.kinds.includes(kind)) ?? [...slots].sort((a, b) => areas.get(b.data.slot) - areas.get(a.data.slot))[0];
  const fits = target ? live.groups.filter((group) => group.kinds.includes(kind) || group.kinds.every((other) => target.data.kinds.includes(other))) : live.groups;
  const holding = fits.filter((group) => group.kinds.includes(kind));
  const pool = holding.length ? holding : fits;
  if (pool.length) return { position: { referenceGroup: (pool.find((group) => group.id === live.active) ?? pool[0]).id } };
  const toSlot = pathTo(plan.root, (data) => data.slot === target?.data.slot);
  const toChat = pathTo(plan.root, isChatSlot);
  if (!toSlot) return { position: { referenceGroup: live.chat, direction: "right" } };
  let depth = 0;
  let node = plan.root;
  while (toSlot[depth] === toChat[depth]) node = node.data[toSlot[depth++]];
  const horizontal = (plan.orientation !== "VERTICAL") === (depth % 2 === 0);
  const before = toSlot[depth] < toChat[depth];
  const extent = node.data[toSlot[depth]].size;
  return { position: { referenceGroup: live.chat, direction: horizontal ? (before ? "left" : "right") : (before ? "above" : "below") }, ...(horizontal ? { initialWidth: extent } : { initialHeight: extent }) };
}

import type { GridNode } from "../grid/grid-types.ts";
import type { PanelPlacement, Preset, PresetKind, Slot } from "./preset-types.ts";
import { isChatSlot } from "./preset-kinds.ts";
import { planSlots } from "./plan-slots.ts";
import { slotAreas } from "./slot-areas.ts";
import { slotLeaves } from "./slot-leaves.ts";

/** The live stage as placement sees it: the chat's group, the active workspace group and each workspace group's kinds. */
type LiveStage = { chat: string; active: string | null; groups: { id: string; kinds: PresetKind[] }[] };

/** Index path from `node` down to the leaf `test` picks, or null. */
function pathTo(node: GridNode<Slot>, test: (data: Slot) => boolean): number[] | null {
  if (node.type === "leaf") return test(node.data) ? [] : null;
  for (const [index, child] of node.data.entries()) { const rest = pathTo(child, test); if (rest) return [index, ...rest]; }
  return null;
}

/** Where a new `kind` ("files" | "terminal") tab goes under the last applied `layout`. Its group there is the first one
 * taking that kind, else the layout's largest workspace group. A live workspace group that can be it (it already holds
 * that kind, or only kinds that group takes) gets the tab: one already holding that kind first, the active one first. Otherwise a new group opens beside
 * the chat on that group's side, at that group's size (the side's extent where the group shares it with others).
 * `live`: the stage's groups; `size`: the stage's `{ width, height }`. Returns dockview addPanel
 * position options. */
export function placeByPreset(layout: Preset, kind: PresetKind | undefined, live: LiveStage, size: { width: number; height: number }): PanelPlacement {
  const plan = planSlots(layout, size.width, size.height);
  const slots = slotLeaves(plan.root).filter((leaf) => !isChatSlot(leaf.data));
  const areas = slotAreas(plan);
  const target = slots.find((leaf) => kind && leaf.data.kinds.includes(kind)) ?? [...slots].sort((a, b) => (areas.get(b.data.slot) ?? 0) - (areas.get(a.data.slot) ?? 0))[0];
  const fits = target ? live.groups.filter((group) => (kind && group.kinds.includes(kind)) || group.kinds.every((other) => target.data.kinds.includes(other))) : live.groups;
  const holding = fits.filter((group) => kind && group.kinds.includes(kind));
  const pool = holding.length ? holding : fits;
  const chosen = pool.find((group) => group.id === live.active) ?? pool[0];
  if (chosen) return { position: { referenceGroup: chosen.id } };
  const toSlot = pathTo(plan.root, (data) => data.slot === target?.data.slot);
  const toChat = pathTo(plan.root, isChatSlot);
  if (!toSlot || !toChat) return { position: { referenceGroup: live.chat, direction: "right" } };
  let depth = 0;
  let node = plan.root;
  while (toSlot[depth] === toChat[depth] && node.type === "branch") node = node.data[toSlot[depth++] ?? 0] ?? node;
  const horizontal = (plan.orientation !== "VERTICAL") === (depth % 2 === 0);
  const before = (toSlot[depth] ?? 0) < (toChat[depth] ?? 0);
  const extent = node.type === "branch" ? node.data[toSlot[depth] ?? 0]?.size : undefined;
  return { position: { referenceGroup: live.chat, direction: horizontal ? (before ? "left" : "right") : (before ? "above" : "below") }, ...(horizontal ? { initialWidth: extent } : { initialHeight: extent }) };
}

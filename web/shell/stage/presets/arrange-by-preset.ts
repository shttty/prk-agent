import type { SerializedDockview } from "dockview-react";
import type { SavedGroup } from "../../../workspace/editor-layout/editor-layout-types.ts";
import type { GridNode } from "../grid/grid-types.ts";
import type { AskedSize, Preset, Slot } from "./preset-types.ts";
import { CHAT_ID } from "../grid/stage-constants.ts";
import { holdsChat } from "../grid/stage-constants.ts";
import { fitGrid } from "../grid/fit-grid.ts";
import { stageGrid } from "../grid/grid-of.ts";
import { mainTests } from "../grid/main-tests.ts";
import { KINDS } from "./preset-kinds.ts";
import { WORK_KINDS } from "./preset-kinds.ts";
import { isChatSlot } from "./preset-kinds.ts";
import { BUILTIN_PRESETS } from "./builtin-presets.ts";
import { planSlots } from "./plan-slots.ts";
import { pruneGrid } from "./prune-grid.ts";
import { slotAreas } from "./slot-areas.ts";
import { slotLeaves } from "./slot-leaves.ts";
import { askedSizes } from "./asked-sizes.ts";

type Arranged = { dockview: SerializedDockview; main: string | null; asked: Record<string, AskedSize> };

const groupsOf = (node: GridNode): SavedGroup[] => (node.type === "leaf" ? [node.data] : node.data.flatMap(groupsOf));

/** The current stage (dockview `toJSON()`, `current`) re-arranged by `layout`: `{ dockview, main, asked }`, dockview JSON
 * to load with `reuseExistingPanels` (so no panel is rebuilt: shells and unsaved text stay), the main area's group id
 * (null: the chat's) and the sizes the layout asks of each group (its preferred sizes, see askedSizes). Every open panel goes, by kind, to the layout's groups of that kind: the n-th current group holding that
 * kind to the n-th such group (the last one takes the rest); a kind the layout has no group for goes to its largest
 * group. Within a group the tabs keep their order and the shown tab stays shown. Groups left without a panel are
 * dropped (a dropped main area leaves the chat as main). Sizes are fitted to `width` x `height` (see fitGrid). A layout
 * with no group besides the chat arranges like built-in layout 1. */
export function arrangeByPreset(layout: Preset, current: SerializedDockview, width: number, height: number): Arranged {
  const all = groupsOf(stageGrid(current.grid).root);
  const work = all.filter((group) => !holdsChat(group));
  const chat = all.find(holdsChat);
  if (!chat) throw new Error("The stage grid has no chat group.");
  const plan = planSlots(layout, width, height);
  const slots = slotLeaves(plan.root).map((leaf) => leaf.data).filter((slot) => !isChatSlot(slot));
  const builtin = BUILTIN_PRESETS[0];
  if (work.length && !slots.length && builtin) return arrangeByPreset({ ...builtin.layout, workspaceOpen: layout.workspaceOpen }, current, width, height);
  const areas = slotAreas(plan);
  const largest = [...slots].sort((a, b) => (areas.get(b.slot) ?? 0) - (areas.get(a.slot) ?? 0))[0];
  const kindOf = (view: string) => KINDS[current.panels[view]?.contentComponent ?? ""];
  const target = new Map<string, number>(); // panel id -> slot
  for (const kind of WORK_KINDS) {
    const owners = slots.filter((slot) => slot.kinds.includes(kind));
    work.filter((group) => group.views.some((view) => kindOf(view) === kind)).forEach((group, index) => {
      const slot = owners.length ? owners[Math.min(index, owners.length - 1)] : largest;
      if (!slot) return;
      for (const view of group.views) if (kindOf(view) === kind) target.set(view, slot.slot);
    });
  }
  const leading = current.activeGroup ? work.find((group) => group.id === current.activeGroup) : undefined;
  const shown = [leading, ...work].flatMap((group) => group?.activeView ?? []);
  const filled = (data: Slot): SavedGroup => {
    if (isChatSlot(data)) return { id: chat.id, views: [CHAT_ID], activeView: CHAT_ID, locked: true, hideHeader: true };
    const views = work.flatMap((group) => group.views.filter((view) => target.get(view) === data.slot));
    return { id: `layout-${data.slot}`, views, activeView: shown.find((view) => views.includes(view)) ?? views[0] };
  };
  const mainSlot = slots.find((slot) => slot.main);
  const fill = (node: GridNode<Slot>): GridNode => (node.type === "leaf" ? { ...node, data: filled(node.data) } : { ...node, data: node.data.map(fill) });
  const grid = pruneGrid({ ...plan, root: fill(plan.root) }, (leaf) => leaf.data.views.length > 0);
  const groups = groupsOf(grid.root);
  const main = mainSlot && groups.some((group) => group.id === `layout-${mainSlot.slot}`) ? `layout-${mainSlot.slot}` : null;
  const first = shown[0];
  const activeGroup = groups.find((group) => first !== undefined && group.views.includes(first))?.id ?? chat.id;
  const asked = Object.fromEntries([...askedSizes(layout)].map(([slot, size]) => [`layout-${slot}`, size]));
  return { dockview: { grid: fitGrid({ ...grid, width, height }, width, height, mainTests(main)), panels: current.panels, activeGroup }, main, asked };
}

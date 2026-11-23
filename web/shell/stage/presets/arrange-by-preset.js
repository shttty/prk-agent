import { CHAT_ID } from "../grid/stage-constants.js";
import { holdsChat } from "../grid/stage-constants.js";
import { fitGrid } from "../grid/fit-grid.js";
import { mainTests } from "../grid/main-tests.js";
import { KINDS } from "./preset-kinds.js";
import { WORK_KINDS } from "./preset-kinds.js";
import { isChatSlot } from "./preset-kinds.js";
import { BUILTIN_PRESETS } from "./builtin-presets.js";
import { planSlots } from "./plan-slots.js";
import { pruneGrid } from "./prune-grid.js";
import { slotAreas } from "./slot-areas.js";
import { slotLeaves } from "./slot-leaves.js";
import { askedSizes } from "./asked-sizes.js";

const groupsOf = (node) => (node.type === "leaf" ? [node.data] : node.data.flatMap(groupsOf));

/** The current stage (dockview `toJSON()`, `current`) re-arranged by `layout`: `{ dockview, main, asked }`, dockview JSON
 * to load with `reuseExistingPanels` (so no panel is rebuilt: shells and unsaved text stay), the main area's group id
 * (null: the chat's) and the sizes the layout asks of each group (its preferred sizes, see askedSizes). Every open panel goes, by kind, to the layout's groups of that kind: the n-th current group holding that
 * kind to the n-th such group (the last one takes the rest); a kind the layout has no group for goes to its largest
 * group. Within a group the tabs keep their order and the shown tab stays shown. Groups left without a panel are
 * dropped (a dropped main area leaves the chat as main). Sizes are fitted to `width` x `height` (see fitGrid). A layout
 * with no group besides the chat arranges like built-in layout 1. */
export function arrangeByPreset(layout, current, width, height) {
  const work = groupsOf(current.grid.root).filter((group) => !holdsChat(group));
  const chat = groupsOf(current.grid.root).find(holdsChat);
  const plan = planSlots(layout, width, height);
  const slots = slotLeaves(plan.root).map((leaf) => leaf.data).filter((slot) => !isChatSlot(slot));
  if (work.length && !slots.length) return arrangeByPreset({ ...BUILTIN_PRESETS[0].layout, workspaceOpen: layout.workspaceOpen }, current, width, height);
  const areas = slotAreas(plan);
  const largest = [...slots].sort((a, b) => areas.get(b.slot) - areas.get(a.slot))[0];
  const kindOf = (view) => KINDS[current.panels[view]?.contentComponent];
  const target = new Map(); // panel id -> slot
  for (const kind of WORK_KINDS) {
    const owners = slots.filter((slot) => slot.kinds.includes(kind));
    work.filter((group) => group.views.some((view) => kindOf(view) === kind)).forEach((group, index) => {
      const slot = owners.length ? owners[Math.min(index, owners.length - 1)] : largest;
      for (const view of group.views) if (kindOf(view) === kind) target.set(view, slot.slot);
    });
  }
  const leading = current.activeGroup ? work.find((group) => group.id === current.activeGroup) : null;
  const shown = [leading, ...work].filter(Boolean).map((group) => group.activeView);
  const filled = (data) => {
    if (isChatSlot(data)) return { id: chat.id, views: [CHAT_ID], activeView: CHAT_ID, locked: true, hideHeader: true };
    const views = work.flatMap((group) => group.views.filter((view) => target.get(view) === data.slot));
    return { id: `layout-${data.slot}`, views, activeView: shown.find((view) => views.includes(view)) ?? views[0] };
  };
  const mainSlot = slots.find((slot) => slot.main);
  const fill = (node) => (node.type === "leaf" ? { ...node, data: filled(node.data) } : { ...node, data: node.data.map(fill) });
  const grid = pruneGrid({ ...plan, root: fill(plan.root) }, (leaf) => leaf.data.views.length > 0);
  const groups = groupsOf(grid.root);
  const main = mainSlot && groups.some((group) => group.id === `layout-${mainSlot.slot}`) ? `layout-${mainSlot.slot}` : null;
  const activeGroup = groups.find((group) => group.views.includes(shown[0]))?.id ?? chat.id;
  const asked = Object.fromEntries([...askedSizes(layout)].map(([slot, size]) => [`layout-${slot}`, size]));
  return { dockview: { grid: fitGrid({ ...grid, width, height }, width, height, mainTests(main)), panels: current.panels, activeGroup }, main, asked };
}

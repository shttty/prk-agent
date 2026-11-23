import { KINDS } from "./preset-kinds.js";
import { mainTests } from "../grid/main-tests.js";
import { withPreferred } from "../grid/with-preferred.js";

/** The arrangement of a serialized stage grid (dockview `toJSON()`) as a layout: the same split tree, each group's
 * preferred size (`preferred`: group id -> `{ width, height }`; else its size now), each group reduced to the kinds of
 * panel it holds, the main area's group (`main`: its id; null: the chat's) marked. No file, diff or shell is
 * recorded. */
export function presetOf(dockview, workspaceOpen, main, preferred = {}) {
  const { isMain } = mainTests(main);
  const kindsOf = (views) => [...new Set(views.map((id) => KINDS[dockview.panels[id]?.contentComponent]).filter(Boolean))].sort();
  const node = (from) => (from.type === "leaf"
    ? { type: "leaf", kinds: kindsOf(from.data.views), size: from.size, ...(isMain(from.data) ? { main: true } : {}) }
    : { type: "branch", size: from.size, data: from.data.map(node) });
  return { orientation: dockview.grid.orientation, workspaceOpen, root: node(withPreferred(dockview.grid, preferred).root) };
}

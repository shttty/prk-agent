import type { SerializedDockview } from "dockview-react";
import type { GridNode, Extents } from "../grid/grid-types.ts";
import type { Preset, PresetNode } from "./preset-types.ts";
import { KINDS } from "./preset-kinds.ts";
import { mainTests } from "../grid/main-tests.ts";
import { stageGrid } from "../grid/grid-of.ts";
import { withPreferred } from "../grid/with-preferred.ts";

/** The arrangement of a serialized stage grid (dockview `toJSON()`) as a layout: the same split tree, each group's
 * preferred size (`preferred`: group id -> `{ width, height }`; else its size now), each group reduced to the kinds of
 * panel it holds, the main area's group (`main`: its id; null: the chat's) marked. No file, diff or shell is
 * recorded. */
export function presetOf(dockview: SerializedDockview, workspaceOpen: boolean, main: string | null, preferred: Extents = {}): Preset {
  const { isMain } = mainTests(main);
  const kindsOf = (views: readonly string[]) => [...new Set(views.flatMap((id) => KINDS[dockview.panels[id]?.contentComponent ?? ""] ?? []))].sort();
  const node = (from: GridNode): PresetNode => (from.type === "leaf"
    ? { type: "leaf", kinds: kindsOf(from.data.views), size: from.size ?? null, ...(isMain(from.data) ? { main: true as const } : {}) }
    : { type: "branch", size: from.size ?? null, data: from.data.map(node) });
  const root = node(withPreferred(stageGrid(dockview.grid), preferred).root);
  if (root.type !== "branch") throw new Error("The stage grid's root is a group.");
  return { orientation: dockview.grid.orientation, workspaceOpen, root };
}

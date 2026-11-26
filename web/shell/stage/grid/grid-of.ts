import type { SerializedDockview } from "dockview-react";
import type { StageGrid } from "./grid-types.ts";

/** dockview's serialized grid typed as the tree with discriminated nodes (the same JSON: a leaf's data is a group, a branch's its children). */
export const stageGrid = (grid: SerializedDockview["grid"]) => grid as StageGrid;

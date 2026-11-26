import type { GridLeaf, GridNode } from "../grid/grid-types.ts";
import type { Slot } from "./preset-types.ts";

/** The leaves of a planned layout (planSlots), in tree order. */
export const slotLeaves = (node: GridNode<Slot>): GridLeaf<Slot>[] => (node.type === "leaf" ? [node] : node.data.flatMap(slotLeaves));

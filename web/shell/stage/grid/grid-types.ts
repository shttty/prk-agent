import type { DockviewApi, SerializedDockview } from "dockview-react";
import type { SavedGroup } from "../../../workspace/editor-layout/editor-layout-types.ts";

/** A serialized dockview grid as a tree with a discriminated node type: a leaf holds one group (`L`), a branch its children. */
export type GridLeaf<L = SavedGroup> = { type: "leaf"; data: L; size?: number; visible?: boolean };
export type GridBranch<L = SavedGroup> = { type: "branch"; data: GridNode<L>[]; size?: number; visible?: boolean };
export type GridNode<L = SavedGroup> = GridLeaf<L> | GridBranch<L>;
export type StageGrid<L = SavedGroup> = Omit<SerializedDockview["grid"], "root"> & { root: GridNode<L> };

export type Extent = { width: number; height: number };

/** Group id -> its size. */
export type Extents = Record<string, Extent>;

/** Which serialized group is the main area and which is the chat's (see mainTests). */
export type GridTests<L = SavedGroup> = { isMain: (group: L) => boolean; isChat: (group: L) => boolean };

/** What the stage's grid element measures (its own box, not dockview's possibly stale size). */
export type GridSize = () => Extent;

/** The record of preferred group sizes (see preferredSizes). */
export type SizingRecord = {
  get: () => Extents;
  set: (next: Extents, current: Extents) => void;
  squeezing: () => void;
  settle: (current: Extents) => void;
  observe: (current: Extents, main: string | null | undefined) => void;
};

export type StageApi = DockviewApi;

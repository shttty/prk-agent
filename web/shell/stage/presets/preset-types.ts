import type { Orientation } from "dockview-react";

/** What a layout records of a group: which kinds of panel it holds. Files and diffs are one kind. */
export type PresetKind = "chat" | "files" | "terminal";

export type PresetLeaf = { type: "leaf"; kinds: PresetKind[]; size: number | null; main?: true };
export type PresetBranch = { type: "branch"; size: number | null; data: PresetNode[] };
export type PresetNode = PresetLeaf | PresetBranch;

/** A layout: the split tree with sizes (`null`: takes what the others leave), kinds per group, the main area, and whether the workspace is open. */
export type Preset = { orientation: Orientation; workspaceOpen: boolean; root: PresetBranch };

/** A saved layout with its name. */
export type SavedPreset = { name: string; layout: Preset };

/** Where a new tab goes (dockview addPanel position options). */
export type PanelPlacement = { position: { referenceGroup: string; direction?: "left" | "right" | "above" | "below" }; initialWidth?: number; initialHeight?: number };

/** What a planned leaf (planSlots) carries: the kinds, whether it is the main area and its index in tree order. */
export type Slot = { kinds: PresetKind[]; main: boolean; slot: number };

/** Sizes a layout asks of a group. */
export type AskedSize = { width?: number; height?: number };

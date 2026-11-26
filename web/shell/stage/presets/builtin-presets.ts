import { Orientation } from "dockview-react";
import type { Preset, PresetKind, PresetLeaf } from "./preset-types.ts";
import { FIRST_GROUP_WIDTH } from "../grid/stage-constants.ts";
import { CARD_GAP } from "../../layout/layout-table.ts";

// The old main-stage swap's chat column: a 420px card, plus the gap around it.
const CHAT_COLUMN = 420 + CARD_GAP;

const leaf = (kinds: PresetKind[], size: number | null, main = false): PresetLeaf => ({ type: "leaf", kinds, size, ...(main ? { main: true as const } : {}) });

/** The two layouts that always exist (never deleted or overwritten). A layout records only the arrangement: the split
 * tree with its sizes (`null`: takes what the others leave), what kinds of panel each group holds, which group is the
 * main area (`main`: it absorbs window and sidebar changes), and whether the workspace is open. 1: the chat is the main
 * area on the left, files and shells in a group on its right. 2: the other way round, the workspace is the main area on
 * the left and the chat a fixed column on the right. */
type BuiltinPreset = { id: string; name: string; layout: Preset };

export const BUILTIN_PRESETS: [BuiltinPreset, BuiltinPreset] = [
  { id: "builtin:1", name: "布局 1", layout: { orientation: Orientation.HORIZONTAL, workspaceOpen: true, root: { type: "branch", size: null, data: [leaf(["chat"], null, true), leaf(["files", "terminal"], FIRST_GROUP_WIDTH)] } } },
  { id: "builtin:2", name: "布局 2", layout: { orientation: Orientation.HORIZONTAL, workspaceOpen: true, root: { type: "branch", size: null, data: [leaf(["files", "terminal"], null, true), leaf(["chat"], CHAT_COLUMN)] } } },
];

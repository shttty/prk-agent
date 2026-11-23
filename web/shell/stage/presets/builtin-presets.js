import { FIRST_GROUP_WIDTH } from "../grid/stage-constants.js";
import { CARD_GAP } from "../../layout/layout-table.js";

// The old main-stage swap's chat column: a 420px card, plus the gap around it.
const CHAT_COLUMN = 420 + CARD_GAP;

const leaf = (kinds, size, main = false) => ({ type: "leaf", kinds, size, ...(main ? { main } : {}) });

/** The two layouts that always exist (never deleted or overwritten). A layout records only the arrangement: the split
 * tree with its sizes (`null`: takes what the others leave), what kinds of panel each group holds, which group is the
 * main area (`main`: it absorbs window and sidebar changes), and whether the workspace is open. 1: the chat is the main
 * area on the left, files and shells in a group on its right. 2: the other way round, the workspace is the main area on
 * the left and the chat a fixed column on the right. */
export const BUILTIN_PRESETS = [
  { id: "builtin:1", name: "布局 1", layout: { orientation: "HORIZONTAL", workspaceOpen: true, root: { type: "branch", size: null, data: [leaf(["chat"], null, true), leaf(["files", "terminal"], FIRST_GROUP_WIDTH)] } } },
  { id: "builtin:2", name: "布局 2", layout: { orientation: "HORIZONTAL", workspaceOpen: true, root: { type: "branch", size: null, data: [leaf(["files", "terminal"], null, true), leaf(["chat"], CHAT_COLUMN)] } } },
];

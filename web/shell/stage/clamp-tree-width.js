import { TREE_MIN } from "../layout/layout-table.js";

const TREE_MAX = 560;

/** The directory's width as shown and saved: TREE_MIN..560 (a saved value outside it is shown clamped). */
export const clampTreeWidth = (value) => Math.round(Math.max(TREE_MIN, Math.min(TREE_MAX, value)));

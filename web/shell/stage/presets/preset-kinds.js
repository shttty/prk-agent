import { FILE_COMPONENT } from "../../../workspace/editor-layout/editor-layout-constants.js";
import { DIFF_COMPONENT } from "../../../workspace/editor-layout/editor-layout-constants.js";
import { TERMINAL_COMPONENT } from "../../../workspace/editor-layout/editor-layout-constants.js";
import { CHAT_COMPONENT } from "../grid/stage-constants.js";

// What a layout records of a group: which kinds of panel it holds. Files and diffs are one kind.
export const KINDS = { [CHAT_COMPONENT]: "chat", [FILE_COMPONENT]: "files", [DIFF_COMPONENT]: "files", [TERMINAL_COMPONENT]: "terminal" };

export const WORK_KINDS = ["files", "terminal"];

/** Whether a layout leaf (`{ kinds }`, or a grid leaf's data carrying them) is the chat's. */
export const isChatSlot = (data) => Array.isArray(data?.kinds) && data.kinds.includes("chat");

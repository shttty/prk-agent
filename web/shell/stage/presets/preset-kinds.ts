import type { PresetKind } from "./preset-types.ts";
import { FILE_COMPONENT } from "../../../workspace/editor-layout/editor-layout-constants.ts";
import { DIFF_COMPONENT } from "../../../workspace/editor-layout/editor-layout-constants.ts";
import { TERMINAL_COMPONENT } from "../../../workspace/editor-layout/editor-layout-constants.ts";
import { CHAT_COMPONENT } from "../grid/stage-constants.ts";

// What a layout records of a group: which kinds of panel it holds. Files and diffs are one kind.
export const KINDS: Record<string, PresetKind> = { [CHAT_COMPONENT]: "chat", [FILE_COMPONENT]: "files", [DIFF_COMPONENT]: "files", [TERMINAL_COMPONENT]: "terminal" };

export const WORK_KINDS: PresetKind[] = ["files", "terminal"];

/** Whether a layout leaf (`{ kinds }`, or a grid leaf's data carrying them) is the chat's. */
export const isChatSlot = (data: { kinds?: readonly PresetKind[] } | null | undefined) => Array.isArray(data?.kinds) && data.kinds.includes("chat");

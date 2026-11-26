import type { Engine } from "../editor-dock/engine/engine-types.ts";

type DebugTool = { id: string; label: string; open: (engine: Engine) => void };

/** The debug tools menu's items, in order; a new tool is a new row. */
export const DEBUG_TOOLS: readonly DebugTool[] = [
  { id: "prompt", label: "提示词", open: (engine) => engine.openPrompt() },
];

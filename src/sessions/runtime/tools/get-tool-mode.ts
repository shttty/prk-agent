import type { ToolMode } from "../../../config/session/session-options.ts";
import type { RuntimeContext } from "../runtime-state.ts";

export function getToolMode(ctx: RuntimeContext): ToolMode { return ctx.toolMode; }

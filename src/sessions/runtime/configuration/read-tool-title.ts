import { DEFAULT_SESSION_OPTIONS } from "../../../config/session/session-options.ts";
import type { RuntimeContext } from "../runtime-state.ts";

/** Global tool-title switch, read per model request. */
export function toolTitleEnabled(ctx: RuntimeContext): boolean { return ctx.dependencies.toolTitle?.() ?? DEFAULT_SESSION_OPTIONS.toolTitle; }

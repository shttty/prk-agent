import type { NativeActionRequest, NativeActionResult } from "../../../gateway/wire/wire-types.ts";
import type { NativeContext, NativeTarget } from "../native-types.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";
import { TOOL_MODES, type ToolMode } from "../../../config/session/session-options.ts";
import { result } from "../dispatch/format-action-result.ts";
import { actionFailure } from "../dispatch/action-failure.ts";

export function setToolMode(ctx: NativeContext, target: NativeTarget, request: NativeActionRequest): NativeActionResult {
  try {
    if (target.readOnly) throw new WireError("UNAVAILABLE", "Tool mode requires a writable session.");
    if (!target.setToolMode) throw new WireError("UNAVAILABLE", "This session cannot change tool mode.");
    const mode = request.args?.mode;
    if (Object.keys(request.args ?? {}).some((key) => key !== "mode") || !(TOOL_MODES as readonly unknown[]).includes(mode)) throw new WireError("INVALID_REQUEST", "Tool mode must be code or direct.");
    target.setToolMode(mode as ToolMode);
    return result(request, "completed", "Tool mode updated.", { toolMode: mode });
  } catch (error) { return actionFailure(request, error); }
}

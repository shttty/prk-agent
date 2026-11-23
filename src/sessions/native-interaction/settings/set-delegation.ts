import type { NativeActionRequest, NativeActionResult } from "../../../gateway/wire/wire-types.ts";
import type { NativeContext, NativeTarget } from "../native-types.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";
import { DELEGATION_LEVELS, type DelegationLevel } from "../../../config/session/delegation-levels.ts";
import { result } from "../dispatch/format-action-result.ts";
import { actionFailure } from "../dispatch/action-failure.ts";

export function setDelegation(_ctx: NativeContext, target: NativeTarget, request: NativeActionRequest): NativeActionResult {
  try {
    if (target.readOnly) throw new WireError("UNAVAILABLE", "Delegation requires a writable session.");
    if (!target.setDelegation) throw new WireError("UNAVAILABLE", "This session cannot change delegation.");
    const level = request.args?.level;
    if (Object.keys(request.args ?? {}).some((key) => key !== "level") || !(DELEGATION_LEVELS as readonly unknown[]).includes(level)) {
      throw new WireError("INVALID_REQUEST", "Delegation level must be gated, restrained or eager.");
    }
    target.setDelegation(level as DelegationLevel);
    return result(request, "completed", "Delegation updated.", { delegation: level });
  } catch (error) { return actionFailure(request, error); }
}

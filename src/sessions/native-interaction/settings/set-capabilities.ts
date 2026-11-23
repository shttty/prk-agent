import type { NativeActionRequest, NativeActionResult } from "../../../gateway/wire/wire-types.ts";
import type { NativeContext, NativeTarget } from "../native-types.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";
import { isCapabilityBatch } from "../../../config/capabilities/is-capability-batch.ts";
import { result } from "../dispatch/format-action-result.ts";
import { actionFailure } from "../dispatch/action-failure.ts";

export async function setCapabilities(ctx: NativeContext, target: NativeTarget, request: NativeActionRequest): Promise<NativeActionResult> {
  try {
    if (!target.capabilityCatalog) throw new WireError("UNAVAILABLE", "Capabilities require an active session.");
    const args = request.args ?? {};
    if (Object.keys(args).length === 0) {
      await target.refreshRegistration?.();
      return result(request, "completed", "Capabilities loaded.", target.capabilityCatalog());
    }
    if (target.readOnly || !target.setCapabilities) throw new WireError("UNAVAILABLE", "Capabilities require a writable session.");
    if (Object.keys(args).some((key) => key !== "changes") || !isCapabilityBatch(args)) throw new WireError("INVALID_REQUEST", "Capabilities require exactly {changes: [{id, enabled: boolean | null}, ...]} with distinct IDs.");
    target.setCapabilities(args.changes);
    const message = "Capabilities updated; declarations apply on the next model request, permissions immediately.";
    return result(request, "completed", message, target.capabilityCatalog());
  } catch (error) { return actionFailure(request, error); }
}

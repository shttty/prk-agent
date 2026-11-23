import type { HostContext } from "../../host/host-state.ts";
import type { NativeActionRequest, NativeActionResult } from "../../wire/wire-types.ts";
import { WireError } from "../../wire/create-error.ts";

export function acknowledgeModelFallback(ctx: HostContext, sessionId: string, request: NativeActionRequest): NativeActionResult {
  if (request.sessionId !== sessionId) throw new WireError("INVALID_REQUEST", "Native action routing identity does not match the selected Gateway session.");
  ctx.methods.storedSession(sessionId);
  if (Object.keys(request.args ?? {}).length) throw new WireError("INVALID_REQUEST", "acknowledge-model-fallback requires empty args.");
  ctx.models.modelFallbacks.delete(sessionId);
  ctx.sessionHosts.hostBindings.get(sessionId)?.refresh(true);
  return { requestId: request.requestId, action: request.action, status: "completed", message: "Model fallback acknowledged." };
}

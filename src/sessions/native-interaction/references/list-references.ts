import type { NativeActionRequest, NativeActionResult } from "../../../gateway/wire/wire-types.ts";
import type { NativeContext, NativeTarget } from "../native-types.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";
import { result } from "../dispatch/format-action-result.ts";

export async function listReferences(ctx: NativeContext, target: NativeTarget, request: NativeActionRequest): Promise<NativeActionResult> {
  if (target.readOnly || !target.target || !target.referenceCandidates) throw new WireError("READ_ONLY", "Target reference discovery is unavailable for this session.");
  if (request.args?.target !== target.target || request.args?.sessionId !== target.sessionId) throw new WireError("INVALID_REQUEST", "Reference discovery must match the exact session target and session.");
  const path = request.args.path;
  if (Object.keys(request.args).some((key) => !["target", "sessionId", "path"].includes(key)) || typeof path !== "string" || path.length > ctx.limits.cwdChars || /[\\\p{Cc}]/u.test(path)) throw new WireError("INVALID_REQUEST", "reference-candidates accepts only target, sessionId and a bounded path token.");
  const data = await target.referenceCandidates(path);
  return result(request, "completed", "Target reference candidates loaded.", data);
}

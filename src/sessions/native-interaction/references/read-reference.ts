import type { NativeActionRequest, NativeActionResult } from "../../../gateway/wire/wire-types.ts";
import type { NativeContext, NativeTarget } from "../native-types.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";
import { result } from "../dispatch/format-action-result.ts";
import { absolutePath } from "../../../workspace/target-paths/absolute-path.ts";

export async function readReference(ctx: NativeContext, target: NativeTarget, request: NativeActionRequest): Promise<NativeActionResult> {
  if (target.readOnly || !target.target || !target.readReference) throw new WireError("READ_ONLY", "Target reference reads are unavailable for this session.");
  if (request.args?.target !== target.target || request.args?.sessionId !== target.sessionId) throw new WireError("INVALID_REQUEST", "Reference reads must match the exact session target and session.");
  const path = request.args.path;
  if (Object.keys(request.args).some((key) => !["target", "sessionId", "path"].includes(key)) || typeof path !== "string" || path.length > ctx.limits.cwdChars) throw new WireError("INVALID_REQUEST", "reference-read accepts only target, sessionId and an absolute path.");
  absolutePath(path);
  const data = await target.readReference(path);
  return result(request, "completed", "Target reference loaded.", data);
}

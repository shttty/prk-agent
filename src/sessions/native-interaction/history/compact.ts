import { WireError } from "../../../gateway/wire/create-error.ts";
import type { NativeActionRequest } from "../../../gateway/wire/wire-types.ts";
import type { NativeContext, NativeTarget } from "../native-types.ts";
import { argumentText } from "../dispatch/read-text-argument.ts";
import { operationKey } from "../dispatch/identify-request.ts";
import { result } from "../dispatch/format-action-result.ts";

export function compact(ctx: NativeContext, target: NativeTarget, request: NativeActionRequest) {
  const host = target.host;
  if (target.readOnly || !host) throw new WireError("READ_ONLY", "This session is read-only history; no mutation was performed.");
  const { operationId, completion } = host.compact(request.requestId, argumentText(request.args, "instructions"));
  const key = operationKey(target, request.requestId);
  ctx.running.set(key, { action: "compact", cancel: async () => {
    const outcome = await host.cancel({ operationId });
    if (outcome.status !== "requested") throw new WireError("UNAVAILABLE", "Compaction is no longer running.");
  } });
  void completion.then(() => ctx.running.delete(key));
  return result(request, "running", "Compaction accepted.", { operationId });
}

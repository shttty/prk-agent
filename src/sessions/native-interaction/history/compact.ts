import { WireError } from "../../../gateway/wire/create-error.ts";
import type { NativeActionRequest } from "../../../gateway/wire/wire-types.ts";
import type { NativeContext, NativeTarget, NativeActionContext } from "../native-types.ts";
import { argumentText } from "../dispatch/read-text-argument.ts";
import { operationKey } from "../dispatch/identify-request.ts";

export async function compact(ctx: NativeContext, target: NativeTarget, request: NativeActionRequest, operation: NativeActionContext) {
  const { running } = ctx;
  if (target.readOnly || !target.session) throw new WireError("READ_ONLY", "This session is read-only history; no mutation was performed.");
  const { session } = target;
  let abortedBeforeStart = false;
  operation.runningCancel = () => {
    abortedBeforeStart = true;
    session.abortCompaction();
  };
  running.set(operationKey(target, request.requestId), { cancel: operation.runningCancel, action: request.action });
  const activeOperation = target.host?.getSnapshot().operation;
  if (activeOperation) {
    const cancelled = await target.host!.cancel({ operationId: activeOperation.operationId });
    await cancelled.completion;
  }
  if (abortedBeforeStart) throw new Error("Compaction cancelled");
  return await session.compact(argumentText(request.args, "instructions"));
}

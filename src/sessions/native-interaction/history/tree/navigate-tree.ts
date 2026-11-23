import type { NativeActionRequest } from "../../../../gateway/wire/wire-types.ts";
import type { NativeContext, NativeTarget, NativeActionContext } from "../../native-types.ts";
import { WireError } from "../../../../gateway/wire/create-error.ts";
import { requireIdle } from "../../dispatch/require-idle-session.ts";
import { argumentText } from "../../dispatch/read-text-argument.ts";
import { operationKey } from "../../dispatch/identify-request.ts";

export async function navigateTree(ctx: NativeContext, target: NativeTarget, request: NativeActionRequest, operation: NativeActionContext) {
  const { running } = ctx;
  const session = requireIdle(target);
  if (target.host?.hasInFlightCell?.()) throw new WireError("BUSY", "A kernel cell must settle before changing branches.");
  const entryId = argumentText(request.args, "entryId");
  if (!entryId || !target.manager.getEntry(entryId)) throw new WireError("INVALID_REQUEST", "Tree action requires an existing SDK entry ID.");
  const summarize = request.args?.summarize === true;
  if (summarize) {
    operation.runningCancel = () => session.abortBranchSummary();
    running.set(operationKey(target, request.requestId), { cancel: operation.runningCancel, action: request.action });
  }
  return await session.navigateTree(entryId, { summarize });
}

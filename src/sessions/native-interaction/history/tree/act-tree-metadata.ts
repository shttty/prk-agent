import type { NativeActionRequest, NativeActionResult } from "../../../../gateway/wire/wire-types.ts";
import type { NativeContext, NativeTarget } from "../../native-types.ts";
import { WireError } from "../../../../gateway/wire/create-error.ts";
import { operationKey } from "../../dispatch/identify-request.ts";
import { argumentText } from "../../dispatch/read-text-argument.ts";
import { requireIdle } from "../../dispatch/require-idle-session.ts";
import { result } from "../../dispatch/format-action-result.ts";
import { actionFailure } from "../../dispatch/action-failure.ts";
import { treeProjection } from "./read-tree.ts";

export function actTreeMetadata(ctx: NativeContext, target: NativeTarget, request: NativeActionRequest): NativeActionResult {
  const { activeRequests, limits } = ctx;
  const treeRequestKey = operationKey(target, request.requestId);
  if (activeRequests.has(treeRequestKey)) return result(request, "unavailable", "This native request is already active; it was not replayed.", { executed: false, active: true });
  activeRequests.add(treeRequestKey);
  try {
    if (request.action === "tree-label") {
      requireIdle(target);
      const entryId = argumentText(request.args, "entryId");
      if (!entryId || !target.manager.getEntry(entryId)) throw new WireError("INVALID_REQUEST", "tree-label requires an existing SDK entry ID.");
      const label = request.args?.label;
      if (label !== undefined && (typeof label !== "string" || label.length > limits.labelChars || /\p{Cc}/u.test(label))) throw new WireError("INVALID_REQUEST", `Tree label must be at most ${limits.labelChars} characters without control characters.`);
      target.manager.appendLabelChange(entryId, typeof label === "string" && label.length > 0 ? label : undefined);
      return result(request, "completed", "Tree label updated.", { entryId, label: typeof label === "string" && label.length > 0 ? label : undefined });
    }
    const data = request.action === "tree-read" ? { tree: treeProjection(target, limits), activeLeaf: target.manager.getLeafId() }
      : { scope: "web-presentation", action: request.action, tree: treeProjection(target, limits), instruction: "Apply folding, filtering, or clipboard behavior in the Web presentation; SDK history was not changed." };
    return result(request, "completed", "Tree metadata loaded.", data);
  } catch (error) {
    return actionFailure(request, error);
  } finally {
    activeRequests.delete(treeRequestKey);
  }
}

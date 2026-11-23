import type { NativeActionRequest, NativeActionResult } from "../../../gateway/wire/wire-types.ts";
import type { NativeContext, NativeTarget } from "../native-types.ts";
import { result } from "../dispatch/format-action-result.ts";

export function dequeue(ctx: NativeContext, target: NativeTarget, request: NativeActionRequest): NativeActionResult {
  if (!target.host) return result(request, "unavailable", "No active SDK host has queued input.", { executed: false });
  const data = target.host.dequeue();
  return result(request, "completed", data.status === "not_found" ? "No active operation has queued input." : "Queued input was removed without aborting the active operation.", data);
}

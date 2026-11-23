import { WireError } from "../../../gateway/wire/create-error.ts";
import type { NativeActionRequest, NativeActionResult } from "../../../gateway/wire/wire-types.ts";
import { result } from "./format-action-result.ts";
import { isNativeCancellation } from "./is-cancellation.ts";

export function actionFailure(request: NativeActionRequest, error: unknown): NativeActionResult {
  const status = isNativeCancellation(error, request.action) ? "cancelled" : "failed";
  const data = status === "cancelled" || !(error instanceof WireError) ? { outcomeUnknown: true } : { executed: false };
  return result(request, status, error instanceof Error ? error.message : String(error), data);
}

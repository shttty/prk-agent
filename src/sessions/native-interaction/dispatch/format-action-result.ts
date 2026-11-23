import type { NativeActionRequest, NativeActionResult } from "../../../gateway/wire/wire-types.ts";

export function result(request: NativeActionRequest, status: NativeActionResult["status"], message: string, data: unknown): NativeActionResult {
  return { requestId: request.requestId, action: request.action, command: request.action, status, message, ...(data === undefined ? {} : { data }) };
}

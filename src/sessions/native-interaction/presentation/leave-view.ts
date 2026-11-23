import type { NativeActionRequest } from "../../../gateway/wire/wire-types.ts";
import type { NativeContext, NativeTarget } from "../native-types.ts";

export function leaveView(ctx: NativeContext, target: NativeTarget, request: NativeActionRequest) {
  return { leftView: true, gatewayStopped: false };
}

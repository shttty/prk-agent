import type { NativeActionRequest } from "../../../gateway/wire/wire-types.ts";
import type { NativeContext, NativeTarget } from "../native-types.ts";

export function readHotkeys(ctx: NativeContext, target: NativeTarget, request: NativeActionRequest) {
  return { actions: ["send", "newline", "steer", "followUp", "cancel", "dequeue", "cancel-native", "copy", "fold", "current-page-search", "plain-text-escape"], prefixes: ["/", "!", "!!"] };
}

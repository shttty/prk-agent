import type { nativeTarget } from "./dispatch/resolve-native-target.ts";
import type { runNativeLifecycle } from "./lifecycle/execute-native-lifecycle.ts";
import type { nativeCapabilities } from "./dispatch/list-native-actions.ts";
import type { nativeAction } from "./dispatch/execute-native-action.ts";
import type { nativeSend } from "./dispatch/send-input.ts";

type WithoutContext<T> = T extends (ctx: never, ...args: infer A) => infer R ? (...args: A) => R : never;

export interface NativeInteractionsMethods {
  nativeTarget: WithoutContext<typeof nativeTarget>;
  runNativeLifecycle: WithoutContext<typeof runNativeLifecycle>;
  nativeCapabilities: WithoutContext<typeof nativeCapabilities>;
  nativeAction: WithoutContext<typeof nativeAction>;
  nativeSend: WithoutContext<typeof nativeSend>;
}

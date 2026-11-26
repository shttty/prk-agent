import { nativeTarget } from "./dispatch/resolve-native-target.ts";
import { runNativeLifecycle } from "./lifecycle/execute-native-lifecycle.ts";
import { nativeCapabilities } from "./dispatch/list-native-actions.ts";
import { nativeAction } from "./dispatch/execute-native-action.ts";
import { nativeSend } from "./dispatch/send-input.ts";
import { sendStatus } from "./dispatch/send-status.ts";
import type { HostContext } from "../host/host-state.ts";
import type { NativeInteractionsMethods } from "./native-interactions-methods.ts";

export function assembleNativeInteractions(ctx: HostContext): NativeInteractionsMethods {
  return {
    nativeTarget: nativeTarget.bind(undefined, ctx),
    runNativeLifecycle: runNativeLifecycle.bind(undefined, ctx),
    nativeCapabilities: nativeCapabilities.bind(undefined, ctx),
    nativeAction: nativeAction.bind(undefined, ctx),
    nativeSend: nativeSend.bind(undefined, ctx),
    sendStatus: sendStatus.bind(undefined, ctx),
  };
}

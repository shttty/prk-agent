import { markKernelOrphan } from "./kernel/mark-kernel-orphan.ts";
import { exclusive } from "./admission/admit-config-mutation.ts";
import { runtimeChange } from "./admission/admit-runtime-change.ts";
import { recoveryState } from "./recovery/inspect-saved-binding.ts";
import { markUnavailable } from "./recovery/mark-unavailable.ts";
import { kernelUnusable } from "./recovery/kernel-unusable.ts";
import { unsettled } from "./recovery/inspect-runtime-readiness.ts";
import { wake } from "./recovery/wake-runtime.ts";
import { autoRecover } from "./recovery/recover-automatically.ts";
import { ensureRuntime } from "./recovery/ensure-runtime.ts";
import { admitInput } from "./admission/admit-input.ts";
import { changeSessionRuntime } from "./admission/change-session-runtime.ts";
import { maintainSessionKernel } from "./kernel/maintain-kernel.ts";
import { endSession } from "./identity/end-session.ts";
import { createManagedSession } from "./identity/create-session.ts";
import { reclaimIdle } from "./reclamation/reclaim-idle-sessions.ts";
import { kernelVariables } from "./kernel/list-variables.ts";
import { kernelDeleteVariable } from "./kernel/delete-variable.ts";
import { renameSession } from "./identity/rename-session.ts";
import { wakeSession } from "./recovery/wake-session.ts";
import { recoverSession } from "./recovery/recover-session.ts";
import { kernelClear } from "./kernel/clear-kernel.ts";
import { kernelRestart } from "./kernel/restart-kernel.ts";
import type { HostContext } from "../host/host-state.ts";
import type { SessionLifecycleMethods } from "./session-lifecycle-methods.ts";

export function assembleSessionLifecycle(ctx: HostContext): SessionLifecycleMethods {
  return {
    markKernelOrphan: markKernelOrphan.bind(undefined, ctx),
    exclusive: <T>(action: () => Promise<T>) => exclusive(ctx, action),
    runtimeChange: <T>(action: () => Promise<T>) => runtimeChange(ctx, action),
    recoveryState: recoveryState.bind(undefined, ctx),
    markUnavailable: markUnavailable.bind(undefined, ctx),
    kernelUnusable: kernelUnusable.bind(undefined, ctx),
    unsettled: unsettled.bind(undefined, ctx),
    wake: wake.bind(undefined, ctx),
    autoRecover: autoRecover.bind(undefined, ctx),
    ensureRuntime: ensureRuntime.bind(undefined, ctx),
    admitInput: <T>(sessionId: string, action: () => Promise<T>, wakeSleeping?: boolean) => admitInput(ctx, sessionId, action, wakeSleeping),
    changeSessionRuntime: <T>(sessionId: string, action: () => Promise<T>) => changeSessionRuntime(ctx, sessionId, action),
    maintainSessionKernel: maintainSessionKernel.bind(undefined, ctx),
    endSession: endSession.bind(undefined, ctx),
    createManagedSession: createManagedSession.bind(undefined, ctx),
    reclaimIdle: reclaimIdle.bind(undefined, ctx),
    kernelVariables: kernelVariables.bind(undefined, ctx),
    kernelDeleteVariable: kernelDeleteVariable.bind(undefined, ctx),
    renameSession: renameSession.bind(undefined, ctx),
    wakeSession: wakeSession.bind(undefined, ctx),
    recoverSession: recoverSession.bind(undefined, ctx),
    kernelClear: kernelClear.bind(undefined, ctx),
    kernelRestart: kernelRestart.bind(undefined, ctx),
  };
}

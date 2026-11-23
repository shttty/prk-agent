import type { HostContext } from "../../host/host-state.ts";
import type { SessionRuntime } from "../../../sessions/runtime/runtime-types.ts";

export function unsettled(_ctx: HostContext, runtime: Pick<SessionRuntime, "host" | "session" | "kernel">): boolean {
  const hostIdle = runtime.host.isIdle ?? (runtime.host.getSnapshot(false).operation === undefined);
  return !hostIdle || runtime.kernel.hasInFlightCell?.() === true || !runtime.session.isIdle
    || runtime.session.isCompacting || runtime.session.pendingMessageCount > 0;
}

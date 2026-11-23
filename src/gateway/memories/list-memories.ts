import type { HostContext } from "../host/host-state.ts";
import type { GatewaySessionHost } from "../host/host-types.ts";

export function memoryList(ctx: HostContext): ReturnType<GatewaySessionHost["memoryList"]> {
  return ctx.host.memoryStore.list(ctx.instances.targets.map((target) => target.id));
}

import type { HostContext } from "../host/host-state.ts";
import type { GatewaySessionHost } from "../host/host-types.ts";

export function memoryConfigGet(ctx: HostContext, file: Parameters<GatewaySessionHost["memoryConfigGet"]>[0]): ReturnType<GatewaySessionHost["memoryConfigGet"]> {
  return ctx.host.memoryStore.config(file);
}

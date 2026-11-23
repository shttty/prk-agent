import type { HostContext } from "../host/host-state.ts";
import type { GatewaySessionHost } from "../host/host-types.ts";

export function memoryConfigSave(ctx: HostContext, request: Parameters<GatewaySessionHost["memoryConfigSave"]>[0]): ReturnType<GatewaySessionHost["memoryConfigSave"]> {
  return ctx.host.memoryStore.saveConfig(request.file, request.document, request.hash);
}

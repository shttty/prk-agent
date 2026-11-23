import type { HostContext } from "../host/host-state.ts";
import type { GatewaySessionHost } from "../host/host-types.ts";

export function memoryDeleteInstance(ctx: HostContext, instance: Parameters<GatewaySessionHost["memoryDeleteInstance"]>[0]): ReturnType<GatewaySessionHost["memoryDeleteInstance"]> {
      ctx.host.memoryStore.deleteInstance(instance);
      return ctx.api.memoryList();
    }

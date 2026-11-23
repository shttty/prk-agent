import type { HostContext } from "../host/host-state.ts";
import type { GatewaySessionHost } from "../host/host-types.ts";

export function pluginConfigGet(ctx: HostContext, provider: Parameters<GatewaySessionHost["pluginConfigGet"]>[0]): ReturnType<GatewaySessionHost["pluginConfigGet"]> { return ctx.host.pluginConfig.get(provider); }

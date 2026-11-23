import type { HostContext } from "../host/host-state.ts";
import type { GatewaySessionHost } from "../host/host-types.ts";

export function pluginConfigWrite(ctx: HostContext, { provider, changes }: Parameters<GatewaySessionHost["pluginConfigWrite"]>[0]): ReturnType<GatewaySessionHost["pluginConfigWrite"]> { return ctx.host.pluginConfig.write(provider, changes); }

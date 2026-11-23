import type { HostContext } from "../host/host-state.ts";
import type { GatewaySessionHost } from "../host/host-types.ts";

export function pluginConfigSet(ctx: HostContext, { provider, file, sections }: Parameters<GatewaySessionHost["pluginConfigSet"]>[0]): ReturnType<GatewaySessionHost["pluginConfigSet"]> { return ctx.host.pluginConfig.set(provider, file, sections); }

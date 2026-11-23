import type { HostContext } from "../host/host-state.ts";
import type { GatewaySessionHost } from "../host/host-types.ts";

export function toolsChange(ctx: HostContext, action: Parameters<GatewaySessionHost["toolsChange"]>[0], name: Parameters<GatewaySessionHost["toolsChange"]>[1]): ReturnType<GatewaySessionHost["toolsChange"]> { return { tools: ctx.host.toolLibrary.change(action, name) }; }

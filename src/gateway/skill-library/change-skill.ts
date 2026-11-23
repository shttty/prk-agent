import type { HostContext } from "../host/host-state.ts";
import type { GatewaySessionHost } from "../host/host-types.ts";

export function skillsChange(ctx: HostContext, action: Parameters<GatewaySessionHost["skillsChange"]>[0], name: Parameters<GatewaySessionHost["skillsChange"]>[1]): ReturnType<GatewaySessionHost["skillsChange"]> { return { skills: ctx.host.skillLibrary.change(action, name) }; }

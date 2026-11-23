import type { HostContext } from "../host/host-state.ts";
import type { GatewaySessionHost } from "../host/host-types.ts";

export function skillsList(ctx: HostContext): ReturnType<GatewaySessionHost["skillsList"]> { return { skills: ctx.host.skillLibrary.list() }; }

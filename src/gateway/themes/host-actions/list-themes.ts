import type { HostContext } from "../../host/host-state.ts";
import type { GatewaySessionHost } from "../../host/host-types.ts";

export function themesList(ctx: HostContext): ReturnType<GatewaySessionHost["themesList"]> { return ctx.host.themes.list(); }

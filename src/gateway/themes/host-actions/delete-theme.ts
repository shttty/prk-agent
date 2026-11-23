import type { HostContext } from "../../host/host-state.ts";
import type { GatewaySessionHost } from "../../host/host-types.ts";

export function themesDelete(ctx: HostContext, id: Parameters<GatewaySessionHost["themesDelete"]>[0]): ReturnType<GatewaySessionHost["themesDelete"]> { return ctx.host.themes.delete(id); }

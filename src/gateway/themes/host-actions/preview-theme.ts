import type { HostContext } from "../../host/host-state.ts";
import type { GatewaySessionHost } from "../../host/host-types.ts";

export function themesPreview(ctx: HostContext, theme: Parameters<GatewaySessionHost["themesPreview"]>[0]): ReturnType<GatewaySessionHost["themesPreview"]> { return ctx.host.themes.preview(theme); }

import type { HostContext } from "../../host/host-state.ts";
import type { GatewaySessionHost } from "../../host/host-types.ts";

export function themesImport(ctx: HostContext, theme: Parameters<GatewaySessionHost["themesImport"]>[0]): ReturnType<GatewaySessionHost["themesImport"]> { return ctx.host.themes.import(theme); }

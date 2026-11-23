import type { HostContext } from "../host/host-state.ts";
import type { GatewaySessionHost } from "../host/host-types.ts";

export function artifactsCurrent(ctx: HostContext, name: Parameters<GatewaySessionHost["artifactsCurrent"]>[0], version: Parameters<GatewaySessionHost["artifactsCurrent"]>[1]): ReturnType<GatewaySessionHost["artifactsCurrent"]> { return ctx.host.artifactStore.setCurrent(name, version); }

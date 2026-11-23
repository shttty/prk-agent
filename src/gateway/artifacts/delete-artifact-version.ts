import type { HostContext } from "../host/host-state.ts";
import type { GatewaySessionHost } from "../host/host-types.ts";

export function artifactsDelete(ctx: HostContext, name: Parameters<GatewaySessionHost["artifactsDelete"]>[0], version: Parameters<GatewaySessionHost["artifactsDelete"]>[1]): ReturnType<GatewaySessionHost["artifactsDelete"]> { return ctx.host.artifactStore.deleteVersion(name, version); }

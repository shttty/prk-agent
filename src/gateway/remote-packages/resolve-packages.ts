import type { HostContext } from "../host/host-state.ts";
import { resolvePluginPackages } from "../../plugins/packages/resolve-packages.ts";

export function remoteConfiguration(ctx: HostContext, instance: string) {
  return {
    packages: resolvePluginPackages(ctx.host.paths.home, ctx.host.paths.agentDir),
    packageErrors: ctx.packages.remoteCatalogStatuses.get(instance),
  };
}

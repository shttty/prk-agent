import type { HostContext } from "../host/host-state.ts";
import { listLoadablePackages } from "../../plugins/package-load/list-loadable-packages.ts";
import type { LoadablePackage } from "../../plugins/package-load/package-load-types.ts";
import { resolvePluginPackages } from "../../plugins/packages/resolve-packages.ts";

/** The enabled Gateway-settings packages with the providers Gateway bootstrap registered for each. */
export function gatewayLoadablePackages(ctx: HostContext): LoadablePackage[] {
  return listLoadablePackages(resolvePluginPackages(ctx.host.paths.home, ctx.host.paths.agentDir), ctx.models.modelProviders);
}

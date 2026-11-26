import { listLoadablePackages } from "../../../plugins/package-load/list-loadable-packages.ts";
import type { LoadablePackage } from "../../../plugins/package-load/package-load-types.ts";
import { remoteConfiguration } from "../configuration/read-remote-config.ts";
import type { RuntimeContext } from "../runtime-state.ts";

export function sessionPackages(ctx: RuntimeContext): LoadablePackage[] {
  return listLoadablePackages(remoteConfiguration(ctx).packages, ctx.dependencies.modelProviders);
}

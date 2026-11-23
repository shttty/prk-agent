import { remoteConfiguration } from "./resolve-packages.ts";
import { pluginsList } from "./list-packages.ts";
import { pluginsChange } from "./change-packages.ts";
import { pluginsInstall } from "./install-package.ts";
import { pluginsUninstall } from "./uninstall-package.ts";
import type { HostContext } from "../host/host-state.ts";
import type { RemotePackagesMethods } from "./remote-packages-methods.ts";

export function assembleRemotePackages(ctx: HostContext): RemotePackagesMethods {
  return {
    remoteConfiguration: remoteConfiguration.bind(undefined, ctx),
    pluginsList: pluginsList.bind(undefined, ctx),
    pluginsChange: pluginsChange.bind(undefined, ctx),
    pluginsInstall: pluginsInstall.bind(undefined, ctx),
    pluginsUninstall: pluginsUninstall.bind(undefined, ctx),
  };
}

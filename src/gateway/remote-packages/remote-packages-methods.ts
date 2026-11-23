import type { remoteConfiguration } from "./resolve-packages.ts";
import type { pluginsList } from "./list-packages.ts";
import type { pluginsChange } from "./change-packages.ts";
import type { pluginsInstall } from "./install-package.ts";
import type { pluginsUninstall } from "./uninstall-package.ts";

type WithoutContext<T> = T extends (ctx: never, ...args: infer A) => infer R ? (...args: A) => R : never;

export interface RemotePackagesMethods {
  remoteConfiguration: WithoutContext<typeof remoteConfiguration>;
  pluginsList: WithoutContext<typeof pluginsList>;
  pluginsChange: WithoutContext<typeof pluginsChange>;
  pluginsInstall: WithoutContext<typeof pluginsInstall>;
  pluginsUninstall: WithoutContext<typeof pluginsUninstall>;
}

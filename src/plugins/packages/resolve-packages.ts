import { resolvePluginPackage } from "./resolve-package.ts";
import { readPluginPackages } from "./read-packages.ts";
import type { HostPluginPackage } from "./package-types.ts";

export function resolvePluginPackages(cwd: string, agentDir: string): HostPluginPackage[] {
  return readPluginPackages(cwd, agentDir).map((pkg) => resolvePluginPackage(pkg, cwd, agentDir));
}

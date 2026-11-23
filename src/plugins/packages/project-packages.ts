import type { PackageSource } from "@earendil-works/pi-coding-agent";
import type { PluginPackage } from "./package-types.ts";

export function projectPluginPackages(packages: readonly PluginPackage[], location?: PluginPackage["location"]): PackageSource[] {
  return packages.filter((pkg) => pkg.enabled && (location === undefined || pkg.location === location))
    .map(({ enabled: _enabled, location: _location, ...native }) => native);
}

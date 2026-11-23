import type { HostPluginPackage } from "../../plugins/packages/package-types.ts";

export function remoteExtensionFingerprint(packages: readonly HostPluginPackage[]): string {
  return JSON.stringify(packages);
}

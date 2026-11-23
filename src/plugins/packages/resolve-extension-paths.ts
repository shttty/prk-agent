import { DefaultPackageManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import type { HostPluginPackage } from "./package-types.ts";

export async function resolvePluginExtensionPaths(pkg: HostPluginPackage): Promise<string[]> {
  if (pkg.error) throw new Error(pkg.error);
  if (!pkg.installedPath) throw new Error(`Plugin ${pkg.source} is not installed.`);
  const { enabled: _enabled, location: _location, name: _name, installedPath, agentDir, error: _error, ...native } = pkg;
  const manager = new DefaultPackageManager({ cwd: agentDir, agentDir, settingsManager: SettingsManager.inMemory({ packages: [{ ...native, source: installedPath }] }) });
  const resolved = await manager.resolve(async () => "error");
  if (resolved.installFailures?.length) throw new Error(resolved.installFailures.map((failure) => failure.message).join("\n"));
  return resolved.extensions.filter((entry) => entry.enabled).map((entry) => entry.path);
}

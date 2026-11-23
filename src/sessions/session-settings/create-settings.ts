import { isAbsolute } from "node:path";
import { SettingsManager } from "@earendil-works/pi-coding-agent";
import type { ExtensionFilter } from "../../config/extensions/extensions-options.ts";
import { filterPackageEntries } from "../../config/extensions/filter-package-entries.ts";
import { parsePluginPackages } from "../../plugins/packages/parse-packages.ts";
import { projectPluginPackages } from "../../plugins/packages/project-packages.ts";
/**
 * Pi owns its session settings (steering/follow-up modes, compaction, cache warming, ...): they come
 * from <PRK home>/agent/settings.json and project .prk/settings.json exactly as Pi resolves them.
 * Runtime changes stay in memory so session commands never write the user's settings files.
 */
export function createSessionSettings(cwd: string, agentDir: string, extensionFilter?: ExtensionFilter, source?: SettingsManager, pluginFailures?: ReadonlyMap<string, string>): SettingsManager {
  const fileSettings = source ?? SettingsManager.create(cwd, agentDir);
  if (fileSettings.drainErrors().length > 0) throw new Error("Unable to load SDK settings from the independent PRK home/project.");
  const global = fileSettings.getGlobalSettings();
  const packages = parsePluginPackages(global.packages);
  const native = projectPluginPackages(packages.filter(({ source, location }) => location !== "gateway" || !pluginFailures?.has(source))).map((pkg) => {
    const source = typeof pkg === "string" ? pkg : pkg.source;
    return packages.find((entry) => entry.source === source)?.location === "host" ? { ...(typeof pkg === "string" ? { source: pkg } : pkg), extensions: [] } : pkg;
  });
  const project = fileSettings.getProjectSettings();
  const exclusions = pluginFailures?.size ? [...pluginFailures.keys()].filter(isAbsolute).map((path) => `-${path}`) : [];
  const snapshots = {
    global: JSON.stringify({ ...global, ...(exclusions.length ? { extensions: [...(global.extensions ?? []), ...exclusions] } : {}), packages: extensionFilter ? filterPackageEntries(native, extensionFilter) : native }),
    project: JSON.stringify({ ...project, packages: extensionFilter ? filterPackageEntries(project.packages, extensionFilter) : project.packages }),
  };
  return SettingsManager.fromStorage({
    withLock(scope, update) {
      const next = update(snapshots[scope]);
      if (next !== undefined) snapshots[scope] = next;
    },
  }, { projectTrusted: fileSettings.isProjectTrusted() });
}

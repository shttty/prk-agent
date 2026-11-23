import { realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, sep } from "node:path";
import { DefaultPackageManager, SettingsManager } from "@earendil-works/pi-coding-agent";

export async function extensionPaths(bundle: string, root: string, agentDir: string): Promise<string[]> {
  const manager = new DefaultPackageManager({
    cwd: bundle, agentDir, settingsManager: SettingsManager.inMemory({}, { projectTrusted: true }),
  });
  const resources = await manager.resolveExtensionSources([root], { temporary: true });
  const paths = resources.extensions.filter((entry) => entry.enabled).map((entry) => entry.path);
  if (!paths.length) throw new Error("The package does not declare any Pi extensions.");
  for (const path of paths) {
    const local = relative(bundle, await realpath(path));
    if (!local || local.startsWith(`..${sep}`) || isAbsolute(local) || !(await stat(path)).isFile()) {
      throw new Error("Pi extension entries must be files inside the locked bundle.");
    }
  }
  return paths.map((path) => relative(bundle, path));
}

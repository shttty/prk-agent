import { SettingsManager } from "@earendil-works/pi-coding-agent";
import { chmod, mkdir, open } from "node:fs/promises";
import { join } from "node:path";
import { parsePluginPackages } from "./parse-packages.ts";
import type { PluginPackage } from "./package-types.ts";

export async function savePluginPackages(cwd: string, agentDir: string, packages: PluginPackage[]): Promise<void> {
  parsePluginPackages(packages);
  await mkdir(agentDir, { recursive: true });
  const path = join(agentDir, "settings.json");
  try {
    const file = await open(path, "wx", 0o600);
    try { await file.writeFile("{}\n"); } finally { await file.close(); }
  }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  await chmod(path, 0o600);
  const settings = SettingsManager.create(cwd, agentDir, { projectTrusted: false });
  const errors = settings.drainErrors();
  if (errors.length) throw errors[0]!.error;
  settings.setPackages(packages);
  await settings.flush();
  const failures = settings.drainErrors();
  if (failures.length) throw failures[0]!.error;
}

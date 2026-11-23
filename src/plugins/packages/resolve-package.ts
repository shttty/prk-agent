import { DefaultPackageManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { HostPluginPackage, PluginPackage } from "./package-types.ts";

export function resolvePluginPackage(pkg: PluginPackage, cwd: string, agentDir: string): HostPluginPackage {
  const manager = new DefaultPackageManager({ cwd, agentDir, settingsManager: SettingsManager.inMemory() });
  const installedPath = manager.getInstalledPath(pkg.source, "user");
  let name = pkg.source;
  let version: string | undefined;
  let error: string | undefined;
  if (installedPath) {
    try {
      const manifest = JSON.parse(readFileSync(join(installedPath, "package.json"), "utf8"));
      if (typeof manifest.name === "string") name = manifest.name;
      if (typeof manifest.version === "string" && manifest.version) version = manifest.version;
    } catch (cause) { if ((cause as NodeJS.ErrnoException).code !== "ENOENT") error = cause instanceof Error ? cause.message : String(cause); }
  }
  const sourceKind = pkg.source.startsWith("npm:") ? "npm" : /^(git:|(?:https?|ssh):\/\/)/i.test(pkg.source.trim()) ? "git" : "local";
  const home = homedir();
  const path = installedPath ?? pkg.source;
  const sourceDisplay = sourceKind === "local"
    ? path === home ? "~" : path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path
    : pkg.source.replace(sourceKind === "npm" ? /^npm:/ : /^git:(?!\/\/)/, "").trim();
  return { ...pkg, name, ...(version ? { version } : {}), sourceKind, sourceDisplay, installedPath, agentDir, ...(error ? { error } : {}) };
}

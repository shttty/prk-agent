import { SettingsManager } from "@earendil-works/pi-coding-agent";
import { parsePluginPackages } from "./parse-packages.ts";

export function readPluginPackages(cwd: string, agentDir: string) {
  const settings = SettingsManager.create(cwd, agentDir, { projectTrusted: false });
  const errors = settings.drainErrors();
  if (errors.length) throw errors[0]!.error;
  return parsePluginPackages(settings.getGlobalSettings().packages);
}

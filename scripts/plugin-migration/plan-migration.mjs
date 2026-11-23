import { readFileSync, realpathSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { homedir } from "node:os";
import { parse, stringify } from "smol-toml";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { parsePluginPackages } from "../../src/plugins/packages/parse-packages.ts";
import { convertPackages } from "./convert-packages.mjs";

export function planMigration(home, sourceHome, sources = {}) {
  if (!isAbsolute(home) || !isAbsolute(sourceHome)) throw new Error("--home and --source-home must be absolute paths.");
  const owned = realpathSync(home);
  const original = resolve(sourceHome);
  if (owned === original || owned === resolve(homedir(), ".config/pi-remote-kernel")) throw new Error("Migration requires a separate owned copy, never the real PRK home.");
  const settingsPath = join(owned, "agent/settings.json");
  const settingsText = readFileSync(settingsPath, "utf8");
  const settings = JSON.parse(settingsText);
  const configPath = join(owned, "config.toml");
  const instancesPath = join(owned, "instances.toml");
  const configText = readFileSync(configPath, "utf8");
  const instancesText = readFileSync(instancesPath, "utf8");
  const config = parse(configText);
  const instances = parse(instancesText);
  const legacy = [...(config.extensions?.defaultRemote ?? []), ...(instances.instances ?? []).flatMap((instance) => instance.remoteExtensions ?? [])];
  const locations = config.extensions?.locations ?? {};
  const hadLegacy = legacy.length || Object.hasOwn(config.extensions ?? {}, "defaultRemote") || Object.hasOwn(config.extensions ?? {}, "locations") || (instances.instances ?? []).some((instance) => Object.hasOwn(instance, "remoteExtensions"));
  if (!hadLegacy && (settings.packages ?? []).every((pkg) => typeof pkg === "object" && typeof pkg.enabled === "boolean" && ["host", "gateway"].includes(pkg.location))) {
    parsePluginPackages(settings.packages);
    return { home: owned, files: [], packages: settings.packages ?? [] };
  }
  settings.packages = convertPackages(settings.packages ?? [], legacy, locations, original, sources);
  parsePluginPackages(settings.packages);
  if (config.extensions) { delete config.extensions.defaultRemote; delete config.extensions.locations; }
  for (const instance of instances.instances ?? []) delete instance.remoteExtensions;
  parsePrkConfig(config, instances);
  return { home: owned, packages: settings.packages, files: [
    { path: settingsPath, before: settingsText, after: JSON.stringify(settings, null, 2) + "\n", mode: 0o600 },
    { path: configPath, before: configText, after: stringify(config) },
    { path: instancesPath, before: instancesText, after: stringify(instances), mode: 0o600 },
  ] };
}

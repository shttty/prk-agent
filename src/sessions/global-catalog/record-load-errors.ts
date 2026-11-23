import { DefaultPackageManager, type SettingsManager } from "@earendil-works/pi-coding-agent";
import type { CatalogContext } from "./catalog-types.ts";
import { recordPluginError } from "./record-plugin-error.ts";
import { isAbsolute } from "node:path";

export async function recordLoadErrors(ctx: CatalogContext, settingsManager: SettingsManager, errors: readonly { path: string; error: string }[]): Promise<void> {
  if (!errors.length) return;
  const { cwd, agentDir } = ctx.input;
  // The loader's errors carry entry paths, not package metadata. Resolve paths, but don't load or install anything again.
  const { extensions } = await new DefaultPackageManager({ cwd, agentDir, settingsManager }).resolve(async () => "skip");
  const sources = new Map(extensions.filter(({ enabled, metadata }) => enabled && metadata.origin === "package")
    .map(({ path, metadata }) => [path, metadata.source]));
  for (const { path, error } of errors) {
    recordPluginError(ctx, sources.get(path) ?? (isAbsolute(path) || path.startsWith("builtin:") ? path : undefined),
      sources.has(path) ? `${path}: ${error}` : error, path);
  }
}

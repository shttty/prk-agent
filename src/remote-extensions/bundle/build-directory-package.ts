import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ArtifactStore } from "../../artifacts/store/assemble-store.ts";
import { readManifest } from "../../artifacts/store/read-artifact-manifest.ts";
import { nativePlatform } from "./artifacts/detect-artifact-platform.ts";
import { available } from "./artifacts/check-cached-artifact.ts";
import { npm } from "./packages/run-npm.ts";
import { readPackedFiles } from "./packages/read-packed-files.ts";
import { buildRemoteExtensionPackage } from "./build-extension-package.ts";
import type { RemoteExtensionPackage } from "../packages/package-types.ts";
import { packageBuilds } from "./bundle-state.ts";
import { WireError } from "../../gateway/wire/create-error.ts";

export async function buildDirectoryPackage(store: ArtifactStore, directory: string, cacheOnly = false): Promise<RemoteExtensionPackage> {
  const platform = nativePlatform();
  const output = await npm(["pack", "--dry-run", "--json", "--ignore-scripts", "--", directory], directory);
  const files = readPackedFiles(output);
  if (!files) throw new Error(`Unrecognized npm pack output (npm ${(await npm(["--version"], directory)).trim()}) for ${directory}: ${output.slice(0, 200)}`);
  if (!files.length) throw new Error(`Plugin directory cannot be packed: ${directory}`);
  const hash = createHash("sha256").update("live-plugin-v2\0").update(platform).update(process.versions.node);
  for (const path of files.sort((a, b) => a.localeCompare(b))) hash.update(path).update("\0").update(await readFile(join(directory, path))).update("\0");
  try { hash.update(await readFile(join(directory, "package-lock.json"))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const cacheDirectory = join(store.directory, "plugin-builds");
  const packageHash = hash.digest("hex");
  const cache = join(cacheDirectory, `${packageHash}.json`);
  try {
    const cached = JSON.parse(await readFile(cache, "utf8")) as RemoteExtensionPackage;
    const manifest = readManifest(store.directory);
    if (available(manifest, platform, cached.node, "node") && available(manifest, platform, cached.bundle, "bundle")) return cached;
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  if (cacheOnly) throw new WireError("ENVIRONMENT_REQUIRED", "The changed host plugin has not been built; the instance environment deployment builds it.", { packageHash });
  const pending = packageBuilds.get(cache);
  if (pending) return pending;
  const build = (async () => {
    try {
      const result = await buildRemoteExtensionPackage({ store, source: directory, platform });
      await mkdir(cacheDirectory, { recursive: true });
      await writeFile(cache, JSON.stringify(result) + "\n", { mode: 0o600 });
      return result;
    } catch (error) {
      throw new WireError("PLUGIN_BUILD_FAILED", error instanceof Error ? error.message : String(error), { packageHash });
    }
  })();
  packageBuilds.set(cache, build);
  try { return await build; } finally { packageBuilds.delete(cache); }
}

import { createHash, randomUUID } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readManifest } from "../../artifacts/store/read-artifact-manifest.ts";
import { type ArtifactPlatform } from "../../artifacts/store/store-types.ts";
import { type ArtifactStore } from "../../artifacts/store/assemble-store.ts";
import { available } from "./artifacts/check-cached-artifact.ts";
import { publishBundle } from "./artifacts/publish-bundle.ts";
import { nativeBuilds } from "./bundle-state.ts";
import type { RemoteExtensionArtifacts } from "./bundle-types.ts";
import { excludeNestedDependencies } from "./packages/exclude-nested-dependencies.ts";
import { npm } from "./packages/run-npm.ts";
import { hostSourceFiles, sourceDirectory } from "./runtime-source-manifest.ts";
import { WireError } from "../../gateway/wire/create-error.ts";

/** Distribute the installed, locked SDK dependency closure; never install at session startup. */
export async function buildNativeToolHost(options: { store: ArtifactStore; platform: ArtifactPlatform; cacheOnly?: boolean }): Promise<RemoteExtensionArtifacts> {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const lockText = await readFile(join(root, "package-lock.json"), "utf8");
  const hostFiles = await Promise.all(hostSourceFiles.map(({ source }) => readFile(join(sourceDirectory, source))));
  const key = createHash("sha256").update("native-host-v1\0").update(lockText)
    .update(process.versions.node).update(options.platform);
  for (const file of hostFiles) key.update(file);
  const cacheDirectory = join(options.store.directory, "native-tool-hosts");
  const cache = join(cacheDirectory, `${key.digest("hex")}.json`);
  try {
    const cached = JSON.parse(await readFile(cache, "utf8")) as RemoteExtensionArtifacts;
    const manifest = readManifest(options.store.directory);
    if (available(manifest, options.platform, cached.node, "node") && available(manifest, options.platform, cached.bundle, "bundle")) return cached;
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  if (options.cacheOnly) throw new WireError("ENVIRONMENT_REQUIRED", "Deploy the current SDK environment before creating a session.");
  const pending = nativeBuilds.get(cache);
  if (pending) return await pending;
  const build = (async (): Promise<RemoteExtensionArtifacts> => {
    const work = await mkdtemp(join(tmpdir(), "prk-native-tool-host-"));
    const temporary = `${cache}.${randomUUID()}`;
    try {
      const bundle = join(work, "bundle");
      await mkdir(bundle);
      const roots = ["@earendil-works/pi-coding-agent", "jiti", "typebox"];
      const selector = `:is(${roots.map((name) => `[name="${name}"]`).join(",")})`;
      // npm owns dependency resolution, including hoisted and nested dependencies.
      const packages = JSON.parse(await npm(["query", "--offline", `${selector}, ${selector} *`], root)) as Array<{ location: string; version: string }>;
      const lock = JSON.parse(lockText) as { packages: Record<string, { version: string }> };
      for (const name of roots) {
        if (!packages.some((entry) => entry.location === `node_modules/${name}`)) throw new Error(`Native tool host dependency ${name} is not installed.`);
      }
      for (const entry of packages) {
        const path = resolve(root, entry.location);
        if (!entry.location.startsWith("node_modules/") || relative(root, path) !== entry.location
          || lock.packages[entry.location]?.version !== entry.version) throw new Error("Native tool host dependencies do not match package-lock.json.");
        await mkdir(join(bundle, entry.location, ".."), { recursive: true });
        await cp(path, join(bundle, entry.location), { recursive: true, verbatimSymlinks: true,
          filter: (source) => excludeNestedDependencies(path, source) });
      }
      await writeFile(join(bundle, "package.json"), JSON.stringify({ name: "prk-native-tool-host", private: true, type: "module",
        dependencies: Object.fromEntries(roots.map((name) => [name, lock.packages[`node_modules/${name}`]!.version])) }) + "\n");
      for (const [index, { destination }] of hostSourceFiles.entries()) {
        await mkdir(join(bundle, destination, ".."), { recursive: true });
        await writeFile(join(bundle, destination), hostFiles[index]!);
      }
      const { node, bundle: artifact } = await publishBundle(options.store, options.platform, work, bundle);
      const result = { node, bundle: artifact };
      await mkdir(cacheDirectory, { recursive: true, mode: 0o700 });
      await writeFile(temporary, JSON.stringify(result) + "\n", { mode: 0o600 });
      await rename(temporary, cache);
      return result;
    } finally {
      await rm(temporary, { force: true });
      await rm(work, { recursive: true, force: true });
    }
  })();
  nativeBuilds.set(cache, build);
  try { return await build; }
  finally { nativeBuilds.delete(cache); }
}

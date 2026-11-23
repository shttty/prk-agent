import { mkdir, mkdtemp, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { readManifest } from "../../artifacts/store/read-artifact-manifest.ts";
import type { RemoteExtensionPackage } from "../packages/package-types.ts";
import { run } from "./archive/run-archive-command.ts";
import { nativePlatform } from "./artifacts/detect-artifact-platform.ts";
import { sha256 } from "./artifacts/hash-artifact.ts";

// Public-layer deviation: external bundle fixtures use the extractor directly.
export async function extractRemoteExtensionBundle(storeDir: string, pkg: RemoteExtensionPackage): Promise<string> {
  if (pkg.platform !== nativePlatform()) throw new Error(`Cannot load a ${pkg.platform} extension bundle on this Gateway.`);
  const tool = readManifest(storeDir).tools[pkg.bundle];
  const entry = tool?.versions[tool.current]?.platforms[pkg.platform];
  if (pkg.bundle !== `remote-ext-bundle-${pkg.sha256}` || tool?.current !== pkg.sha256
    || Object.keys(tool.versions).length !== 1 || entry?.sha256 !== pkg.sha256) {
    throw new Error(`Remote extension ${pkg.name} does not reference an immutable bundle matching its SHA-256.`);
  }
  const cache = join(storeDir, "remote-extension-bundles");
  const destination = join(cache, pkg.sha256);
  try { if ((await stat(destination)).isDirectory()) return destination; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  await mkdir(cache, { recursive: true, mode: 0o700 });
  const temporary = await mkdtemp(join(cache, ".extract-"));
  try {
    const archive = join(storeDir, "store", pkg.sha256);
    if (await sha256(archive) !== pkg.sha256) throw new Error(`Remote extension ${pkg.name} bundle SHA-256 does not match.`);
    await run("tar", ["-xzf", archive, "-C", temporary, "--no-same-owner", "--no-same-permissions"]);
    try { await rename(temporary, destination); }
    catch (error) {
      if (!["EEXIST", "ENOTEMPTY"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error;
    }
    return destination;
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

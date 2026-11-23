import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import type { ArtifactPlatform } from "../../artifacts/store/store-types.ts";
import type { ArtifactStore } from "../../artifacts/store/assemble-store.ts";
import { parseRemoteExtensionPackage } from "../packages/parse-package.ts";
import type { RemoteExtensionPackage } from "../packages/package-types.ts";
import { nativePlatform } from "./artifacts/detect-artifact-platform.ts";
import { publishBundle } from "./artifacts/publish-bundle.ts";
import { exactVersion, packageName } from "./packages/package-protocol.ts";
import { extensionPaths } from "./packages/resolve-extension-paths.ts";
import { npm } from "./packages/run-npm.ts";

/** Resolve and lock on the Gateway; neither npm nor the registry is used on targets. */
export async function buildRemoteExtensionPackage(options: {
  store: ArtifactStore; source: string; platform?: ArtifactPlatform;
}): Promise<RemoteExtensionPackage> {
  const platform = options.platform ?? nativePlatform();
  if (platform !== "x86_64" && platform !== "aarch64") throw new Error("Unsupported remote extension platform.");
  let expectedName: string | undefined;
  let expectedVersion: string | undefined;
  if (isAbsolute(options.source)) {
    const sourceStat = await stat(options.source);
    if (!sourceStat.isDirectory() && !(sourceStat.isFile() && /\.(?:tgz|tar\.gz)$/u.test(options.source))) throw new Error("Plugin build source must be a local directory or npm tarball.");
  } else {
    const separator = options.source.lastIndexOf("@");
    expectedName = options.source.slice(0, separator);
    expectedVersion = options.source.slice(separator + 1);
    if (separator <= 0 || !packageName.test(expectedName) || !exactVersion.test(expectedVersion)) {
      throw new Error("Remote extensions require an npm name@exact-version or an absolute uploaded tarball path.");
    }
  }
  const work = await mkdtemp(join(tmpdir(), "prk-remote-extension-build-"));
  try {
    const packed = JSON.parse(await npm(["pack", "--json", "--ignore-scripts", "--pack-destination", work, "--", options.source], work)) as Array<{ name: string; version: string; filename: string }>;
    const info = packed[0];
    if (packed.length !== 1 || !info || !packageName.test(info.name) || !exactVersion.test(info.version)
      || (expectedName !== undefined && (info.name !== expectedName || info.version !== expectedVersion))) {
      throw new Error("The npm package identity does not match its pinned source.");
    }
    const bundle = join(work, "bundle");
    await mkdir(bundle);
    await copyFile(join(work, info.filename), join(bundle, "source.tgz"));
    await writeFile(join(bundle, "package.json"), JSON.stringify({ name: "prk-remote-extension-bundle", private: true, type: "module", dependencies: { [info.name]: "file:source.tgz" } }, null, 2) + "\n");
    // Native install scripts are deliberately not executed. Cross-architecture native addons
    // requiring compilation are unsupported; aarch64 selection is a contract, not tested here.
    const install = ["install", "--legacy-peer-deps", "--ignore-scripts", "--include=dev", "--no-audit", "--no-fund", "--save-exact", "--os=linux", `--cpu=${platform === "aarch64" ? "arm64" : "x64"}`];
    await npm([...install, "--package-lock-only"], bundle);
    await npm(["ci", ...install.slice(1)], bundle);
    const root = join(bundle, "node_modules", info.name);
    const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as { name: string; version: string; pi?: { location?: unknown } };
    if (manifest.name !== info.name || manifest.version !== info.version) throw new Error("The locked package identity changed during installation.");
    const extensions = await extensionPaths(bundle, root, join(work, "sdk"));
    const artifact = await publishBundle(options.store, platform, work, bundle);
    return parseRemoteExtensionPackage({
      name: info.name, version: info.version, bundle: artifact.bundle, node: artifact.node,
      sha256: artifact.sha256, platform, extensions,
    });
  } finally { await rm(work, { recursive: true, force: true }); }
}

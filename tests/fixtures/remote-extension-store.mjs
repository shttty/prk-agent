import { execFile } from "node:child_process";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { ArtifactStore } from "../../src/artifacts/store/assemble-store.ts";
import { buildRemoteExtensionPackage } from "../../src/remote-extensions/bundle/build-extension-package.ts";
import { extractRemoteExtensionBundle } from "../../src/remote-extensions/bundle/extract-bundle.ts";
import { prepareNativeToolArtifacts } from "./native-tool-artifacts.mjs";

const run = promisify(execFile);
const fixtures = fileURLToPath(new URL(".", import.meta.url));

// Real npm packages and the production builder; callers explicitly select the bundles their scenarios consume.
// The UI still obtains the original LSP identity from real npm pack metadata, without prebuilding that bundle.
export async function prepareRemoteExtensionStore(root, keys) {
  const directory = join(resolve(root), "remote-extension-fixtures");
  const archives = join(directory, "tarballs");
  const storeDir = join(resolve(root), "assets");
  await mkdir(archives, { recursive: true, mode: 0o700 });
  const store = new ArtifactStore(storeDir);
  const artifacts = await prepareNativeToolArtifacts(root);
  const packages = {};
  const bundlePaths = {};
  const tarballs = {};
  let lspName;
  if (keys.includes("lsp")) {
    packages.lsp = await buildRemoteExtensionPackage({ store, source: "@narumitw/pi-lsp@0.49.11" });
    bundlePaths.lsp = await extractRemoteExtensionBundle(storeDir, packages.lsp);
    lspName = packages.lsp.name;
  } else {
    const original = await run("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", archives, "--", "@narumitw/pi-lsp@0.49.11"], {
      cwd: directory, env: { ...process.env, NODE_ENV: "development" }, maxBuffer: 4 * 1024 * 1024,
    });
    const originalPackages = JSON.parse(original.stdout);
    if (originalPackages.length !== 1) throw new Error("Expected one original pi-lsp package.");
    tarballs.lsp = join(archives, originalPackages[0].filename);
    lspName = originalPackages[0].name;
  }
  const definitions = [
    { key: "languageServers", name: "@prk-tests/remote-lsp", version: "0.49.11", location: "target", dependencies: {
      "@narumitw/pi-lsp": "0.49.11", "typescript": "5.9.3", "typescript-language-server": "5.1.3",
    } },
    { key: "capabilities", name: "@prk-tests/remote-capabilities", version: "1.0.0", file: "remote-extension-capabilities.mjs" },
    { key: "capabilitiesV2", name: "@prk-tests/remote-capabilities", version: "2.0.0", file: "remote-extension-capabilities.mjs" },
    { key: "ui", name: "@prk-tests/remote-ui", version: "1.0.0", location: "target", file: "remote-extension-ui.mjs" },
    { key: "uiV2", name: "@prk-tests/remote-ui", version: "2.0.0", location: "target", file: "remote-extension-ui.mjs" },
  ];
  for (const definition of definitions.filter(({ key }) => keys.includes(key))) {
    const source = join(directory, definition.key);
    await mkdir(source, { recursive: true });
    await writeFile(join(source, "package.json"), JSON.stringify({
      name: definition.name, version: definition.version, private: true, type: "module",
      files: ["index.js"], pi: { extensions: ["./index.js"], location: definition.location },
      dependencies: definition.dependencies ?? {},
    }, null, 2) + "\n");
    if (definition.file) await copyFile(join(fixtures, definition.file), join(source, "index.js"));
    else await writeFile(join(source, "index.js"), 'export { default } from "@narumitw/pi-lsp/dist/index.ts";\n');
    const { stdout } = await run("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", archives], {
      cwd: source, env: { ...process.env, NODE_ENV: "development" }, maxBuffer: 4 * 1024 * 1024,
    });
    const packed = JSON.parse(stdout);
    if (packed.length !== 1) throw new Error(`Expected one owned fixture package for ${definition.key}.`);
    const tarball = join(archives, packed[0].filename);
    tarballs[definition.key] = tarball;
    const pkg = await buildRemoteExtensionPackage({ store, source: tarball });
    packages[definition.key] = pkg;
    bundlePaths[definition.key] = await extractRemoteExtensionBundle(storeDir, pkg);
  }
  return { storeDir, packages, bundlePaths, tarballs, lspName, bunSha256: artifacts.bun.sha256 };
}

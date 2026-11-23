import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ArtifactStore } from "../../src/artifacts/store/assemble-store.ts";
import { readManifest } from "../../src/artifacts/store/read-artifact-manifest.ts";

// PI_TEST_BIN_DIR is a read-only assets root containing manifest.json and store/, not the removed bin layout.
// Copy its real distributed rg into this test's own PRK home; never substitute PATH rg or a mock.
export async function prepareRgArtifact(home) {
  const source = process.env.PI_TEST_BIN_DIR ?? join(process.env.HOME, ".config/pi-remote-kernel/assets");
  const arch = { x64: "x86_64", arm64: "aarch64" }[process.arch];
  if (!arch) throw new Error(`No distributed rg artifact for ${process.arch}`);
  const tool = readManifest(source).tools.rg;
  const asset = tool?.versions[tool.current]?.platforms[arch];
  if (!asset) throw new Error(`No current rg artifact for ${arch} in ${source}; set PI_TEST_BIN_DIR to a populated artifact assets root.`);
  const file = join(source, "store", asset.sha256);
  const assetSha = createHash("sha256").update(await readFile(file)).digest("hex");
  const binDir = join(home, "assets");
  await new ArtifactStore(binDir).upload("rg", tool.current, arch, createReadStream(file), assetSha);
  return { binDir, assetSha };
}

import { readManifest } from "../store/read-artifact-manifest.ts";

// Pair verified against uv's embedded download-metadata.json for this release.
const pythonVersion = "3.12.12";
const release = "20251209";
const pythonFilename = `cpython-${pythonVersion}+${release}-x86_64-unknown-linux-gnu-install_only_stripped.tar.gz`;
export const MANAGED_PYTHON = {
  platform: "x86_64",
  distribution: `cpython-${pythonVersion}-linux-x86_64-gnu`,
  release,
  uv: { name: "uv", version: "0.9.17", filename: "uv", sha256: "6810effb93aac03b18749ca5ec14f7545b49aa6e0dec5033da003eda126009e0" },
  python: { name: "python-build-standalone", version: `${pythonVersion}+${release}`, filename: pythonFilename, sha256: "0233aa8f4e8f3314a9be071f68a289f25f6c33b368ad8b2a1726c09981d00d2f" },
} as const;

export function readPythonRelease(directory: string) {
  const { tools } = readManifest(directory);
  const { uv, python, platform } = MANAGED_PYTHON;
  const entry = ({ name, version, sha256 }: typeof uv | typeof python) => {
    const found = tools[name]?.versions[version]?.platforms[platform];
    if (found?.sha256 !== sha256) throw new Error(`Missing pinned artifact ${name}@${version} (${platform}); run scripts/import-python-artifacts.mjs.`);
    return found;
  };
  const pythonEntry = entry(python);
  if (!pythonEntry.minGlibc) throw new Error(`Pinned artifact ${python.name}@${python.version} has no measured glibc requirement; re-import it.`);
  return { uv: entry(uv), python: { ...pythonEntry, minGlibc: pythonEntry.minGlibc } };
}

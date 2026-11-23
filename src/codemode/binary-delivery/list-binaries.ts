import { readManifest } from "../../artifacts/store/read-artifact-manifest.ts";
import { MANAGED_PYTHON } from "../../artifacts/python/python-release.ts";

export function listBinaries(directory: string): string[] {
  return Object.entries(readManifest(directory).tools)
    .filter(([name, tool]) => !name.startsWith("remote-ext-") && name !== "bun" && name !== MANAGED_PYTHON.uv.name && name !== MANAGED_PYTHON.python.name && Object.keys(tool.versions[tool.current]?.platforms ?? {}).length > 0)
    .map(([name]) => name).sort();
}

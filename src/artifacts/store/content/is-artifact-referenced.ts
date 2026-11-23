import type { ArtifactManifest } from "../store-types.ts";

export function referenced(manifest: ArtifactManifest, sha256: string): boolean {
  return Object.values(manifest.tools).some((tool) => Object.values(tool.versions)
    .some((version) => Object.values(version.platforms).some((entry) => entry.sha256 === sha256)));
}

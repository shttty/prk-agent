import { ArtifactError } from "../../upload-error/create-artifact-error.ts";
import type { ArtifactManifest, ArtifactVersion } from "../store-types.ts";

export function findVersion(manifest: ArtifactManifest, name: string, version: string): ArtifactVersion {
  if (!Object.hasOwn(manifest.tools, name) || !Object.hasOwn(manifest.tools[name]!.versions, version)) {
    throw new ArtifactError(404, "Artifact version was not found.");
  }
  return manifest.tools[name]!.versions[version]!;
}

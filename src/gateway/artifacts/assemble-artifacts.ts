import { artifactsList } from "./list-artifacts.ts";
import { artifactsUpload } from "./upload-artifact.ts";
import { artifactsCurrent } from "./select-artifact-version.ts";
import { artifactsDelete } from "./delete-artifact-version.ts";
import type { HostContext } from "../host/host-state.ts";
import type { ArtifactsMethods } from "./artifacts-methods.ts";

export function assembleArtifacts(ctx: HostContext): ArtifactsMethods {
  return {
    artifactsList: artifactsList.bind(undefined, ctx),
    artifactsUpload: artifactsUpload.bind(undefined, ctx),
    artifactsCurrent: artifactsCurrent.bind(undefined, ctx),
    artifactsDelete: artifactsDelete.bind(undefined, ctx),
  };
}

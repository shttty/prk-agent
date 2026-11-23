import type { artifactsList } from "./list-artifacts.ts";
import type { artifactsUpload } from "./upload-artifact.ts";
import type { artifactsCurrent } from "./select-artifact-version.ts";
import type { artifactsDelete } from "./delete-artifact-version.ts";

type WithoutContext<T> = T extends (ctx: never, ...args: infer A) => infer R ? (...args: A) => R : never;

export interface ArtifactsMethods {
  artifactsList: WithoutContext<typeof artifactsList>;
  artifactsUpload: WithoutContext<typeof artifactsUpload>;
  artifactsCurrent: WithoutContext<typeof artifactsCurrent>;
  artifactsDelete: WithoutContext<typeof artifactsDelete>;
}

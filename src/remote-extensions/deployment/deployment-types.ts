import type { ArtifactPlatform } from "../../artifacts/store/store-types.ts";
import type { TargetLease } from "../../target-channel/lease/lease-types.ts";
import type { RemoteExtensionArtifacts } from "../bundle/bundle-types.ts";

export type RemoteExtensionArtifactSource = RemoteExtensionArtifacts | ((platform: ArtifactPlatform) => Promise<RemoteExtensionArtifacts>);

export interface DeploymentContext {
  lease: TargetLease;
  storeDir: string;
  target: { system: string; machine: string };
  binChunkBytes: number;
}

export interface DeploymentArtifact {
  name: string;
  kind: "binary" | "tar" | "tool";
  sha256: string;
  size: number;
  path: string;
  cached: boolean;
}

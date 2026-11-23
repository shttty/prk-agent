export type ArtifactPlatform = "x86_64" | "aarch64";
export interface ArtifactEntry { sha256: string; size: number; addedAt: string; minGlibc?: string }
export interface ArtifactVersion { platforms: Partial<Record<ArtifactPlatform, ArtifactEntry>> }
export interface ArtifactTool { current: string; versions: Record<string, ArtifactVersion> }
export interface ArtifactManifest { tools: Record<string, ArtifactTool> }
export interface ArtifactUploadRequest {
  name: string;
  version: string;
  platform: ArtifactPlatform;
  source: string;
  sha256?: string;
}

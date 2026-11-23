export interface ArtifactsOptions {
  readonly maxUploadBytes: number;
}

export const DEFAULT_ARTIFACTS_OPTIONS: ArtifactsOptions = Object.freeze({
  maxUploadBytes: 200 * 1024 * 1024,
});

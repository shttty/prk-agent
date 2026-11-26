/** One uploaded file of a tool version on one platform. */
export type ArtifactAsset = { sha256: string; size: number; addedAt: string };

export type ArtifactTool = { current: string; versions: Record<string, { platforms: Record<string, ArtifactAsset> }> };

/** `/artifacts`: the remote tools by name and the upload limit. */
export type ArtifactList = { tools: Record<string, ArtifactTool>; maxUploadBytes: number };

export type ArtifactForm = { name: string; version: string; platform: string; sha256: string };

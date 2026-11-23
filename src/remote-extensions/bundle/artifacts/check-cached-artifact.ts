import type { ArtifactManifest, ArtifactPlatform } from "../../../artifacts/store/store-types.ts";

export function available(manifest: ArtifactManifest, platform: ArtifactPlatform, name: string, kind: string): boolean {
  if (typeof name !== "string") return false;
  const sha = name.slice(`remote-ext-${kind}-`.length);
  const tool = manifest.tools[name];
  return name === `remote-ext-${kind}-${sha}` && /^[a-f0-9]{64}$/u.test(sha)
    && tool?.current === sha && Object.keys(tool.versions).length === 1
    && tool.versions[sha]?.platforms[platform]?.sha256 === sha;
}

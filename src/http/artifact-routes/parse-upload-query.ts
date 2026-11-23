import type { ArtifactPlatform } from "../../artifacts/store/store-types.ts";
import { HttpError } from "../request/create-error.ts";
import { artifactIdentity } from "./parse-artifact-identity.ts";

export function artifactUploadRequest(url: URL): { name: string; version: string; platform: ArtifactPlatform; sha256?: string } {
  const query = url.searchParams;
  const keys = [...query.keys()];
  if (keys.length !== 3 + Number(query.has("sha256"))
    || keys.some((key) => !["name", "version", "platform", "sha256"].includes(key) || query.getAll(key).length !== 1)) {
    throw new HttpError(400, "Artifact upload requires name, version, platform and an optional sha256 exactly once.");
  }
  const name = artifactIdentity(query.get("name"), "name");
  const version = artifactIdentity(query.get("version"), "version");
  const platform = query.get("platform");
  if (platform !== "x86_64" && platform !== "aarch64") throw new HttpError(400, "Artifact platform must be x86_64 or aarch64.");
  const sha256 = query.get("sha256");
  if (sha256 !== null && !/^[A-Fa-f0-9]{64}$/.test(sha256)) throw new HttpError(400, "Artifact sha256 must contain exactly 64 hexadecimal digits.");
  return { name, version, platform, ...(sha256 === null ? {} : { sha256 }) };
}

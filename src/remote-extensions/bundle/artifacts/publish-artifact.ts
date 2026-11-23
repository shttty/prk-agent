import { createReadStream } from "node:fs";
import { ArtifactError } from "../../../artifacts/upload-error/create-artifact-error.ts";
import { readManifest } from "../../../artifacts/store/read-artifact-manifest.ts";
import { type ArtifactPlatform } from "../../../artifacts/store/store-types.ts";
import { type ArtifactStore } from "../../../artifacts/store/assemble-store.ts";
import { sha256 } from "./hash-artifact.ts";

export async function publish(store: ArtifactStore, kind: "node" | "bundle", platform: ArtifactPlatform, path: string): Promise<{ name: string; sha256: string }> {
  const digest = await sha256(path);
  const name = `remote-ext-${kind}-${digest}`;
  const existing = readManifest(store.directory).tools[name];
  if (existing && (existing.current !== digest || Object.keys(existing.versions).length !== 1)) {
    throw new Error(`Remote extension artifact ${name} is not immutable.`);
  }
  if (!existing?.versions[digest]?.platforms[platform]) {
    try { await store.upload(name, digest, platform, createReadStream(path), digest); }
    catch (error) {
      // Concurrent identical builds may publish the same immutable artifact first.
      const entry = readManifest(store.directory).tools[name]?.versions[digest]?.platforms[platform];
      if (!(error instanceof ArtifactError) || error.status !== 409 || entry?.sha256 !== digest) throw error;
    }
  } else if (existing.versions[digest]!.platforms[platform]!.sha256 !== digest) {
    throw new Error(`Remote extension artifact ${name} does not match its immutable reference.`);
  }
  return { name, sha256: digest };
}

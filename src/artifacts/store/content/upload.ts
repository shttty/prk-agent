import { createHash, randomUUID } from "node:crypto";
import { link, mkdir, open, rm } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_ARTIFACTS_OPTIONS } from "../../../config/artifacts/artifacts-options.ts";
import { ArtifactError } from "../../upload-error/create-artifact-error.ts";
import { readManifest } from "../read-artifact-manifest.ts";
import type { ArtifactManifest, ArtifactPlatform } from "../store-types.ts";
import type { StoreContext } from "../store-state.ts";
import { mutate } from "../manifest/mutate.ts";
import { publish } from "../manifest/publish.ts";
import { referenced } from "./is-artifact-referenced.ts";

export function upload(ctx: StoreContext, name: string, version: string, platform: ArtifactPlatform, source: AsyncIterable<Uint8Array>,
    expectedSha256?: string, maxBytes = DEFAULT_ARTIFACTS_OPTIONS.maxUploadBytes, minGlibc?: string): Promise<ArtifactManifest> {
    return mutate(ctx, async () => {
      const manifest = readManifest(ctx.directory);
      const tool = Object.hasOwn(manifest.tools, name) ? manifest.tools[name] : undefined;
      const existing = tool && Object.hasOwn(tool.versions, version) ? tool.versions[version] : undefined;
      if (existing?.platforms[platform]) throw new ArtifactError(409, "Artifact version and platform already exist.");
      await mkdir(join(ctx.directory, "store"), { recursive: true, mode: 0o700 });
      const temporary = join(ctx.directory, `.upload-${randomUUID()}`);
      try {
        const file = await open(temporary, "wx", 0o600);
        const hash = createHash("sha256");
        let size = 0;
        try {
          for await (const chunk of source) {
            if (chunk.byteLength > maxBytes - size) throw new ArtifactError(413, "Artifact upload exceeds the byte limit.");
            size += chunk.byteLength;
            hash.update(chunk);
            await file.writeFile(chunk);
          }
          await file.sync();
        } finally { await file.close(); }
        const sha256 = hash.digest("hex");
        if (expectedSha256 !== undefined && sha256 !== expectedSha256.toLowerCase()) {
          throw new ArtifactError(400, "Artifact SHA-256 does not match the expected value.");
        }
        const blob = join(ctx.directory, "store", sha256);
        const previouslyReferenced = referenced(manifest, sha256);
        let created = false;
        try {
          await link(temporary, blob);
          created = true;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        }
        if (!tool) manifest.tools[name] = { current: version, versions: {} };
        const versions = manifest.tools[name]!.versions;
        if (!existing) versions[version] = { platforms: {} };
        versions[version]!.platforms[platform] = { sha256, size, addedAt: new Date().toISOString(), ...(minGlibc === undefined ? {} : { minGlibc }) };
        try { await publish(ctx, manifest); }
        catch (error) {
          if (created && !previouslyReferenced) await rm(blob, { force: true });
          throw error;
        }
        return manifest;
      } finally { await rm(temporary, { force: true }); }
    });
  }

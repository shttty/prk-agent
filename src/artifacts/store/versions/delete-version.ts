import { rm } from "node:fs/promises";
import { join } from "node:path";
import { ArtifactError } from "../../upload-error/create-artifact-error.ts";
import type { ArtifactManifest } from "../store-types.ts";
import type { StoreContext } from "../store-state.ts";
import { readManifest } from "../read-artifact-manifest.ts";
import { mutate } from "../manifest/mutate.ts";
import { publish } from "../manifest/publish.ts";
import { referenced } from "../content/is-artifact-referenced.ts";
import { findVersion } from "./find-version.ts";

export function deleteVersion(ctx: StoreContext, name: string, version: string): Promise<ArtifactManifest> {
    return mutate(ctx, async () => {
      const manifest = readManifest(ctx.directory);
      const entry = findVersion(manifest, name, version);
      const tool = manifest.tools[name]!;
      if (tool.current === version) throw new ArtifactError(409, "The current artifact version cannot be deleted.");
      delete tool.versions[version];
      await publish(ctx, manifest);
      for (const sha256 of new Set(Object.values(entry.platforms).map((platform) => platform.sha256))) {
        if (!referenced(manifest, sha256)) await rm(join(ctx.directory, "store", sha256), { force: true });
      }
      return manifest;
    });
  }

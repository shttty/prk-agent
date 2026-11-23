import type { ArtifactManifest } from "../store-types.ts";
import type { StoreContext } from "../store-state.ts";
import { readManifest } from "../read-artifact-manifest.ts";
import { mutate } from "../manifest/mutate.ts";
import { publish } from "../manifest/publish.ts";
import { findVersion } from "./find-version.ts";

export function setCurrent(ctx: StoreContext, name: string, version: string): Promise<ArtifactManifest> {
    return mutate(ctx, async () => {
      const manifest = readManifest(ctx.directory);
      findVersion(manifest, name, version);
      if (manifest.tools[name]!.current !== version) {
        manifest.tools[name]!.current = version;
        await publish(ctx, manifest);
      }
      return manifest;
    });
  }

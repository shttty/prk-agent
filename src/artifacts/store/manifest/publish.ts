import { randomUUID } from "node:crypto";
import { open, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import type { ArtifactManifest } from "../store-types.ts";
import type { StoreContext } from "../store-state.ts";

export async function publish(ctx: StoreContext, manifest: ArtifactManifest): Promise<void> {
    const temporary = join(ctx.directory, `.manifest-${randomUUID()}`);
    try {
      const file = await open(temporary, "wx", 0o600);
      try {
        await file.writeFile(JSON.stringify(manifest, null, 2) + "\n");
        await file.sync();
      } finally { await file.close(); }
      await rename(temporary, join(ctx.directory, "manifest.json"));
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  }

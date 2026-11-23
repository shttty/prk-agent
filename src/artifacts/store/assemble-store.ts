import type { StoreContext } from "./store-state.ts";
import type { ArtifactManifest, ArtifactPlatform } from "./store-types.ts";
import { upload } from "./content/upload.ts";
import { setCurrent } from "./versions/set-current.ts";
import { deleteVersion } from "./versions/delete-version.ts";

/** One API process owns mutations; explicit CLI imports run offline. */
export class ArtifactStore {
  readonly directory: string;
  upload: (name: string, version: string, platform: ArtifactPlatform, source: AsyncIterable<Uint8Array>, expectedSha256?: string, maxBytes?: number, minGlibc?: string) => Promise<ArtifactManifest>;
  setCurrent: (name: string, version: string) => Promise<ArtifactManifest>;
  deleteVersion: (name: string, version: string) => Promise<ArtifactManifest>;

  constructor(directory: string) {
    this.directory = directory;
    const ctx: StoreContext = { directory, pending: Promise.resolve() };
    this.upload = upload.bind(null, ctx);
    this.setCurrent = setCurrent.bind(null, ctx);
    this.deleteVersion = deleteVersion.bind(null, ctx);
  }
}

import type { ArtifactManifest } from "../store-types.ts";
import type { StoreContext } from "../store-state.ts";

export function mutate(ctx: StoreContext, operation: () => Promise<ArtifactManifest>): Promise<ArtifactManifest> {
    // ponytail: serialize upload streams too; stage concurrently only if throughput requires it.
    const result = ctx.pending.then(operation);
    ctx.pending = result.catch(() => {});
    return result;
  }

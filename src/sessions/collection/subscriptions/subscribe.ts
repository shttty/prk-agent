import type { SessionLifecycleListener } from "../collection-types.ts";
import type { CollectionContext } from "../collection-state.ts";

export function subscribe(ctx: CollectionContext, listener: SessionLifecycleListener): () => void {
      ctx.listeners.add(listener);
      return () => {
        ctx.listeners.delete(listener);
      };
    }

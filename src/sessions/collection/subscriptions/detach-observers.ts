import type { SessionRecord } from "../collection-types.ts";
import type { CollectionContext } from "../collection-state.ts";

export function detachObservers(ctx: CollectionContext, record: SessionRecord): void {
    record.unsubscribeKernel?.();
    record.unsubscribeHost?.();
    record.unsubscribeKernel = undefined;
    record.unsubscribeHost = undefined;
  }

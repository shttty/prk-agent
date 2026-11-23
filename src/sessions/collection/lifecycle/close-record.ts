import type { SessionRecord } from "../collection-types.ts";
import { emit } from "../subscriptions/publish-lifecycle.ts";
import { detachObservers } from "../subscriptions/detach-observers.ts";
import { close } from "./close.ts";
import type { CollectionContext } from "../collection-state.ts";

export function closeRecord(ctx: CollectionContext, record: SessionRecord): Promise<void> {
    if (record.closing) return record.closing;
    record.tombstoned = true;
    record.state = "closing";
    detachObservers(ctx, record);
    const promise = (async () => {
      await Promise.resolve();
      try {
        let session = record.session;
        if (record.pending) {
          try {
            session = await record.pending;
          } catch {
            // createSession owns cleanup for a failed construction.
          }
        }
        if (session) {
          record.session = session;
          await session.close();
        }
      } finally {
        // Unconfirmed cleanup still ends the session; the rejection reports it to the caller.
        detachObservers(ctx, record);
        record.state = "closed";
        if (!record.closeEventEmitted) {
          record.closeEventEmitted = true;
          emit(ctx, "session_closed", record);
        }
      }
    })();
    record.closing = promise;
    return promise;
  }

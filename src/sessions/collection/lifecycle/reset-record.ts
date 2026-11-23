import type { SessionRecord } from "../collection-types.ts";
import { detachObservers } from "../subscriptions/detach-observers.ts";
import { close } from "./close.ts";
import type { CollectionContext } from "../collection-state.ts";

export async function resetRecord(ctx: CollectionContext, record: SessionRecord): Promise<void> {
    let failure: unknown;
    if (record.closing) {
      try { await record.closing; }
      catch (error) { failure = error; }
      finally { record.closing = undefined; }
    }
    const session = record.pending ? await record.pending.catch(() => record.session) : record.session;
    record.state = "closing";
    detachObservers(ctx, record);
    if (session) {
      try { await session.close(); }
      catch (error) { failure = error; }
      finally {
        detachObservers(ctx, record);
      }
    }
    record.session = undefined;
    record.pending = undefined;
    detachObservers(ctx, record);
    record.closing = undefined;
    record.closeEventEmitted = false;
    // Recovery cleanup is not a permanent close. Keep the record closed and
    // explicitly recoverable, even when owned shutdown was itself uncertain.
    record.tombstoned = false;
    record.requiresRecovery = true;
    record.state = "closed";
    if (failure) throw failure;
  }

import { emit } from "../subscriptions/publish-lifecycle.ts";
import { detachObservers } from "../subscriptions/detach-observers.ts";
import { attachObservers } from "../subscriptions/attach-observers.ts";
import { get } from "../records/get.ts";
import type { CollectionContext } from "../collection-state.ts";

export async function reload(ctx: CollectionContext, sessionId: string): Promise<void> {
      if (ctx.closed) throw new Error("Session collection is closed.");
      const record = ctx.records.get(sessionId);
      if (!record) throw new Error("Unknown sessionId.");
      const session = record.session;
      if (record.tombstoned || !session || record.state === "closed" || record.state === "closing") {
        throw new Error("Session has no active runtime; reload never creates or wakes one.");
      }
      const kernel = session.kernel?.getSnapshot();
      if (record.pending || record.state !== "idle" || session.host.isIdle === false
        || session.host.getSnapshot().state !== "idle" || !session.session.isIdle
        || session.session.isCompacting || session.session.pendingMessageCount > 0
        || session.kernel?.hasInFlightCell?.() || kernel?.state === "busy" || kernel?.state === "starting") {
        throw new Error("Session must be idle to reload.");
      }
      detachObservers(ctx, record);
      record.state = "starting";
      const pending = Promise.resolve().then(async () => {
        await session.reload();
        return session;
      });
      record.pending = pending;
      emit(ctx, "session_starting", record);
      try {
        await pending;
      } finally {
        if (record.pending === pending) record.pending = undefined;
        if (!record.tombstoned && !ctx.closed) {
          attachObservers(ctx, record, session);
          const state = session.host.getSnapshot().state;
          record.state = state === "running" || state === "cancel_requested" ? "running" : state;
          if (record.state === "closed") record.requiresRecovery = true;
          emit(ctx, `session_${record.state}`, record);
        }
      }
    }

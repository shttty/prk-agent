import type { SessionRuntime } from "../../runtime/runtime-types.ts";
import { log } from "../lifecycle/log-lifecycle.ts";
import type { SessionRecord } from "../collection-types.ts";
import { emit } from "./publish-lifecycle.ts";
import { detachObservers } from "./detach-observers.ts";
import { subscribe } from "./subscribe.ts";
import type { CollectionContext } from "../collection-state.ts";

export function attachObservers(ctx: CollectionContext, record: SessionRecord, session: SessionRuntime): void {
    detachObservers(ctx, record);
    if (record.tombstoned || ctx.closed) return;
    if (session.kernel) {
      try {
        // Lifecycle frame: memory ticks and namespace belong to the session's own host stream.
        let published = "";
        record.unsubscribeKernel = session.kernel.subscribe(({ state, kernelId, connectionStatus, lastOutcome }) => {
          const key = `${state}|${kernelId}|${connectionStatus}|${lastOutcome}`;
          if (record.tombstoned || ctx.closed || key === published) return;
          published = key;
          emit(ctx, "session_kernel", record, { kernel: { state, kernelId, connectionStatus, lastOutcome } });
        });
      } catch {
        log(record.sessionId, "kernel observer subscription failed");
      }
    }
    if (session.host) {
      record.unsubscribeHost = session.host.subscribe((event) => {
        if (record.tombstoned || ctx.closed) return;
        if (event.type === "session_event" && event.details?.sdkType === "session_info_changed") emit(ctx, "session_renamed", record);
        if (!(event.type === "state_changed" && event.details?.state) && event.type !== "host_closed") return;
        const state = session.host.state;
        const next = state === "running" || state === "cancel_requested" ? "running" : state;
        if (record.state !== next) {
          record.state = next;
          if (next === "closed") record.tombstoned = true;
          emit(ctx, `session_${next}`, record, next === "running" && session.host.operationKind === "compact" ? { compacting: true } : undefined);
        }
      }).unsubscribe;
    }
  }

import { log } from "../lifecycle/log-lifecycle.ts";
import type { SessionLifecycleEvent } from "../collection-types.ts";
import type { SessionRecord } from "../collection-types.ts";
import type { CollectionContext } from "../collection-state.ts";

export function emit(ctx: CollectionContext, type: string, record: SessionRecord, details?: Readonly<Record<string, unknown>>): void {
    const event = Object.freeze({
      type,
      sessionId: record.sessionId,
      timestamp: new Date().toISOString(),
      ...(details === undefined ? {} : { details }),
    }) as SessionLifecycleEvent;
    for (const listener of [...ctx.listeners]) {
      try {
        const result: unknown = listener(event);
        if (typeof result === "object" && result !== null && "then" in result && typeof result.then === "function") {
          void Promise.resolve(result).catch(() => log(record.sessionId, "lifecycle subscriber failed"));
        }
      } catch {
        log(record.sessionId, "lifecycle subscriber failed");
      }
    }
  }

import { get } from "./get.ts";
import type { CollectionContext } from "../collection-state.ts";

export function forget(ctx: CollectionContext, sessionId: string): void {
      const record = ctx.records.get(sessionId);
      if (!record) return;
      // closeRecord retains the disposed session and settled close promise for history/idempotence.
      if (record.state !== "closed") {
        throw new Error("Only a closed session binding can be released for a new execution environment.");
      }
      ctx.records.delete(sessionId);
    }

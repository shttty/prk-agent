import { closeRecord } from "./close-record.ts";
import type { CollectionContext } from "../collection-state.ts";

export function closeSession(ctx: CollectionContext, sessionId: string): Promise<void> {
      const record = ctx.records.get(sessionId);
      if (!record) return Promise.reject(new Error("Unknown sessionId."));
      return closeRecord(ctx, record);
    }

import { resetRecord } from "./reset-record.ts";
import { get } from "../records/get.ts";
import type { CollectionContext } from "../collection-state.ts";

export async function reset(ctx: CollectionContext, sessionId: string): Promise<void> {
      const record = ctx.records.get(sessionId);
      if (!record) throw new Error("Unknown sessionId.");
      if (record.tombstoned) return;
      await resetRecord(ctx, record);
    }

import { closeRecord } from "./close-record.ts";
import type { CollectionContext } from "../collection-state.ts";

export function close(ctx: CollectionContext): Promise<void> {
      return ctx.closing ??= (async () => {
        ctx.closed = true;
        const results = await Promise.allSettled([...ctx.records.values()].map((record) => closeRecord(ctx, record)));
        const failures = results.flatMap((result) => result.status === "rejected" ? [result.reason] : []);
        if (failures.length) throw new AggregateError(failures, "Session collection close failed.");
      })();
    }

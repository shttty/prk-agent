import type { ExecutionTarget } from "../../../config/execution-target/target-types.ts";
import { checkedTargets } from "./check-targets.ts";
import type { CollectionContext } from "../collection-state.ts";

export function replaceTargets(ctx: CollectionContext, targets: readonly ExecutionTarget[]): void {
    const next = checkedTargets(ctx, targets);
    ctx.configured.clear();
    for (const [name, target] of next) ctx.configured.set(name, target);
    for (const [sessionId, record] of ctx.records) {
      const target = next.get(record.target.id);
      if (target === undefined) ctx.records.delete(sessionId);
      else {
        record.target = target;
      }
    }
  }

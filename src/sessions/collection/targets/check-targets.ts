import type { ExecutionTarget } from "../../../config/execution-target/target-types.ts";
import { ExecutionTargetBusyError } from "../create-execution-target-busy-error.ts";
import { sessionBound } from "./is-bound.ts";
import { targetMatches } from "./compare-binding.ts";
import { validateTargets } from "./validate-targets.ts";
import { get } from "../records/get.ts";
import type { CollectionContext } from "../collection-state.ts";

export function checkedTargets(ctx: CollectionContext, targets: readonly ExecutionTarget[]): Map<string, ExecutionTarget> {
    if (ctx.closed) throw new Error("Session collection is closed.");
    const next = validateTargets(targets);
    for (const record of ctx.records.values()) {
      const targetName = record.target.id;
      const candidate = next.get(targetName);
      if ((candidate === undefined || !targetMatches(record.target, candidate)) && sessionBound(record)) {
        throw new ExecutionTargetBusyError(targetName);
      }
    }
    return next;
  }

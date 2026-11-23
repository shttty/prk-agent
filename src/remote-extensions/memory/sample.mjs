import { join } from "node:path";
import { read } from "./read-scope-file.mjs";
import { integer } from "./parse-scope-integer.mjs";
import { counter } from "./read-scope-counter.mjs";

export function sample(ctx) {
  const scope = ctx.scope;
  const current = integer(read(scope, "memory.current"), join(scope, "memory.current"));
  const inactiveFile = counter(scope, "memory.stat", "inactive_file");
  const memoryMax = read(scope, "memory.max");
  const memorySwapMax = read(scope, "memory.swap.max");
  if (integer(memoryMax, join(scope, "memory.max")) === 0) throw new Error("Remote host memory.max must be positive");
  integer(memorySwapMax, join(scope, "memory.swap.max"));
  const oomKill = counter(scope, "memory.events", "oom_kill");
  ctx.baseline ??= current;
  return { current, workingSet: Math.max(0, current - inactiveFile), baseline: ctx.baseline, extra: current - ctx.baseline,
    scope, memoryMax, memorySwapMax, oomKill };
}

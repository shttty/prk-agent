import type { ExecutionTarget } from "../../../config/execution-target/target-types.ts";

export function validateTargets(targets: readonly ExecutionTarget[]): Map<string, ExecutionTarget> {
  const result = new Map<string, ExecutionTarget>();
  for (const target of targets) {
    if (result.has(target.id)) throw new Error("Session target IDs must be unique.");
    result.set(target.id, target);
  }
  return result;
}

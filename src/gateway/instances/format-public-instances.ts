import { configurationIssue } from "../../config/execution-target/configuration-issue.ts";
import type { ExecutionTarget } from "../../config/execution-target/target-types.ts";
import type { PublicExecutionTarget } from "./instance-types.ts";

export function sanitizeTargets(targets: readonly ExecutionTarget[]): readonly PublicExecutionTarget[] {
  return Object.freeze(targets.map((target) => Object.freeze({
    id: target.id,
    label: target.label,
    local: target.local === true,
    tags: Object.freeze([...(target.tags ?? [])]),
    ...(target.python === undefined ? {} : { python: target.python }),
    ...(configurationIssue(target) ? { configurationIssue: configurationIssue(target) } : {}),
  })));
}

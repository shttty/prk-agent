import type { ExecutionTarget } from "./target-types.ts";
import { configurationIssue } from "./configuration-issue.ts";

export function requireConfigured(target: ExecutionTarget): void {
  const issue = configurationIssue(target);
  if (issue) throw Object.assign(new Error(issue.message), { code: "INVALID_REQUEST", details: { configurationIssue: issue }, submitted: false });
}

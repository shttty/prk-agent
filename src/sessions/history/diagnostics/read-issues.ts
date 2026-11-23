import type { HistoryContext, SessionReadIssue } from "../history-types.ts";

export function readIssues(ctx: HistoryContext): readonly SessionReadIssue[] {
  return Object.freeze([...ctx.readFailures.values()].map(({ issue }) => issue));
}

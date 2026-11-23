import type { HistoryContext } from "../history-types.ts";
import { latestProject } from "./read-project.ts";

export function projectNamed(ctx: HistoryContext, name: string): { id: string; name: string } | undefined {
  const { records, limits } = ctx;
  for (const candidate of records.values()) {
    const membership = latestProject(candidate.manager.getEntries(), limits);
    if (membership.projectId !== undefined && membership.projectName === name) return { id: membership.projectId, name };
  }
  return undefined;
}

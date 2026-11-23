import type { HistoryContext, StoredSession } from "../history-types.ts";
import { getRecord } from "../catalog/find-record.ts";
import { invalid } from "../reject-invalid-history.ts";
import { projectValue } from "./validate-project.ts";
import { latestProject } from "./read-project.ts";
import { writeProject } from "./write-project.ts";
import { stored as storedRecord } from "../catalog/format-stored-session.ts";

export function assignProject(ctx: HistoryContext, sessionId: string, project: { readonly id: string; readonly name: string } | null): StoredSession {
  const { limits, records } = ctx;
  const record = getRecord(ctx, sessionId);
  if (record === undefined) invalid(`unknown session ${JSON.stringify(sessionId)}`);
  let next = projectValue(project, limits);
  if (next !== null) {
    for (const candidate of records.values()) {
      const membership = latestProject(candidate.manager.getEntries(), limits);
      if (membership.projectId === next.id) { next = { id: next.id, name: membership.projectName! }; break; }
    }
  }
  writeProject(record.manager, next);
  return storedRecord(record);
}

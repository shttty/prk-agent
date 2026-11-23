import type { HostContext } from "../host/host-state.ts";
import type { ArchiveGroup, ArchivedSession } from "./archive-types.ts";
import type { StoredSession, SessionReadIssue } from "../../sessions/history/history-types.ts";
import { readSessionDerivation } from "../session-views/readability/read-session-derivation.ts";
import { readTaskTiming } from "../../sessions/derivation/read-task-timing.ts";
import { describeReadFailure } from "../session-views/readability/describe-read-failure.ts";

export function archiveGroups(ctx: HostContext, issues: SessionReadIssue[]): readonly ArchiveGroup[] {
  const groups = new Map<string, StoredSession[]>();
  for (const entry of ctx.host.history.listArchived()) {
    const members = groups.get(entry.archived!.group) ?? [];
    members.push(entry);
    groups.set(entry.archived!.group, members);
  }
  return Object.freeze([...groups].map(([group, members]) => {
    const root = members.find((entry) => entry.sessionId === group) ?? members[0]!;
    const sessions: ArchivedSession[] = [];
    for (const entry of members) {
      try {
        const derived = readSessionDerivation(ctx, entry);
        sessions.push(Object.freeze({
          sessionId: entry.sessionId, label: entry.label,
          owner: derived?.owner ?? null,
          ...(derived ? { lifecycle: derived.lifecycle } : {}),
          ...readTaskTiming(derived, entry.archived!.at),
          ...(entry.archived!.kernelOrphan ? { kernelOrphan: true } : {}),
          target: entry.target,
          ...(entry.projectId === undefined ? {} : { projectId: entry.projectId, projectName: entry.projectName }),
        }));
      } catch (error) { issues.push(describeReadFailure(entry, error)); }
    }
    return Object.freeze({ group, label: root.label, at: root.archived!.at, sessions: Object.freeze(sessions) });
  }).sort((left, right) => right.at.localeCompare(left.at)));
}

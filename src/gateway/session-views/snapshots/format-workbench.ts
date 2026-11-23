import type { HostContext } from "../../host/host-state.ts";
import type { WorkbenchSnapshot } from "../session-view-types.ts";
import type { SessionReadIssue } from "../../../sessions/history/history-types.ts";

export function workbenchSnapshot(ctx: HostContext): WorkbenchSnapshot {
  const projectionIssues: SessionReadIssue[] = [];
  const sessions = ctx.methods.managed(projectionIssues);
  const archive = ctx.methods.archiveGroups(projectionIssues);
  const unreadableSessions = Object.freeze([...ctx.host.history.readIssues(), ...projectionIssues]);
  for (const issue of unreadableSessions) {
    const identity = issue.sessionId === undefined ? `file:${issue.sessionFile}` : `session:${issue.sessionId}`;
    if (ctx.views.reportedUnreadableSessions.has(identity)) continue;
    ctx.views.reportedUnreadableSessions.add(identity);
    console.warn(`[${new Date().toISOString()}] WARN unreadable session ${JSON.stringify(issue)}`);
  }
  return Object.freeze({ targets: ctx.instances.publicTargets.map((target) => ({ ...target, environment: ctx.methods.getTargetEnvironment({ target: target.id }) })), sessions, archive, unreadableSessions, sessionControl: ctx.methods.sessionControl() });
}

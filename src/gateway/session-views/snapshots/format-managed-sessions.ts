import type { HostContext } from "../../host/host-state.ts";
import type { SessionSnapshot } from "../session-view-types.ts";
import type { SessionReadIssue } from "../../../sessions/history/history-types.ts";
import { describeReadFailure } from "../readability/describe-read-failure.ts";

export function managed(ctx: HostContext, issues?: SessionReadIssue[]): readonly SessionSnapshot[] {
  const sessions: SessionSnapshot[] = [];
  for (const entry of ctx.host.history.listAll()) {
    try { sessions.push(ctx.methods.managedSessionSnapshot(entry)); }
    catch (error) { issues?.push(describeReadFailure(entry, error)); }
  }
  return Object.freeze(sessions);
}

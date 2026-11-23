import type { HostContext } from "../../host/host-state.ts";
import type { StoredSession } from "../../../sessions/history/history-types.ts";
import type { SessionRecovery } from "../../../sessions/collection/collection-types.ts";
import { configurationIssue } from "../../../config/execution-target/configuration-issue.ts";

export function recoveryState(ctx: HostContext, entry: StoredSession): SessionRecovery {
    const target = ctx.instances.targets.find((candidate) => candidate.id === entry.target);
    if (!target) return { status: "unavailable", message: "The saved session target is no longer configured; choose new explicitly." };
    const issue = configurationIssue(target);
    if (issue) return { status: "unavailable", message: issue.message };
    return { status: "available", message: "The next explicit input can start a new empty Python environment." };
  }

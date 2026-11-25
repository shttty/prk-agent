import { configurationIssue } from "../../../config/execution-target/configuration-issue.ts";
import type { HostContext } from "../../host/host-state.ts";
import type { StoredSession } from "../../../sessions/history/history-types.ts";
import type { SessionRecovery } from "../../../sessions/collection/collection-types.ts";
import type { ManagedSessionSnapshot } from "../../../sessions/collection/collection-types.ts";
import { readSessionDerivation } from "../readability/read-session-derivation.ts";
import { readTaskTiming } from "../../../sessions/derivation/read-task-timing.ts";

export function managedSessionSnapshot(ctx: HostContext, entry: StoredSession, recovery?: SessionRecovery): ManagedSessionSnapshot {
    const live = ctx.host.collection.snapshot().find((session) => session.sessionId === entry.sessionId);
    const liveRecovery = recovery ?? ctx.lifecycle.recoveryStates.get(entry.sessionId);
  const archivedRecovery = !entry.sleeping && (live === undefined || live.state === "closed") ? ctx.methods.recoveryState(entry) : undefined;
    const derived = readSessionDerivation(ctx, entry);
    const unavailable = !entry.sleeping && liveRecovery?.status === "unavailable" && (live === undefined || live.state === "closed");
    const target = ctx.instances.targets.find((candidate) => candidate.id === entry.target);
    const issue = target && configurationIssue(target);
    const projectCreated = entry.projectId === undefined ? undefined : ctx.host.projectDates.get(entry.projectId);
    const monitor = ctx.monitoring.monitor.get(entry.sessionId);
    return Object.freeze({
   ...(entry.sleeping ? { state: "sleeping" } : unavailable ? { ...live, state: "unavailable" } : live ?? { state: "closed" }),
      target: entry.target,
      label: entry.label,
      cwd: entry.cwd,
      ...(issue ? { configurationIssue: issue } : {}),
      ...(entry.projectId === undefined ? {} : { projectId: entry.projectId }),
      ...(entry.projectName === undefined ? {} : { projectName: entry.projectName }),
      ...(projectCreated === undefined ? {} : { projectCreated }),
      sessionId: entry.sessionId,
      history: true,
      requiresReload: !entry.sleeping && live?.state !== "closed" && live?.state !== "closing" && live?.requiresReload === true,
      ...(derived ? { derivation: derived } : {}),
      ...readTaskTiming(derived, entry.archived?.at),
      ...(liveRecovery === undefined && archivedRecovery === undefined ? {} : { recovery: liveRecovery ?? archivedRecovery }),
      ...(monitor ? { monitor } : {}),
      ...(!entry.sleeping && monitor?.processes.some((row) => row.ownership === "detached") ? { background: true } : {}),
    } as ManagedSessionSnapshot);
  }

import { electSupervisor } from "../../sessions/session-control/elect-supervisor.ts";
import type { SupervisorCandidate } from "../../sessions/session-control/control-types.ts";
import { writeSessionControl } from "../../sessions/session-control/write-session-control.ts";
import type { HostContext } from "../host/host-state.ts";

/** Re-elect roles from current membership; true when the persisted designations changed. */
export function refreshSessionControl(ctx: HostContext): boolean {
  const sessions = ctx.host.history.listAll();
  const root = sessions.find((entry) => entry.sessionId === ctx.control.value.rootSessionId);
  const rootSessionId = root && ctx.instances.targets.some((target) => target.id === root.target && target.local === true)
    ? root.sessionId : null;
  const projects = new Map<string, SupervisorCandidate[]>();
  for (const entry of sessions) {
    if (entry.projectId === undefined) continue;
    const timestamp = entry.manager.getHeader()?.timestamp;
    const createdAt = timestamp === undefined ? NaN : Date.parse(timestamp);
    if (!Number.isFinite(createdAt)) throw new Error("Session supervisor election requires an SDK creation timestamp.");
    const candidate = { sessionId: entry.sessionId, createdAt };
    const members = projects.get(entry.projectId);
    if (members) members.push(candidate);
    else projects.set(entry.projectId, [candidate]);
  }
  const supervisors: Record<string, string> = Object.create(null);
  for (const [projectId, candidates] of projects) {
    const selected = electSupervisor(candidates, ctx.control.value.supervisors[projectId]);
    if (selected !== null) supervisors[projectId] = selected;
  }
  const value = { rootSessionId, supervisors };
  const previous = ctx.control.value.supervisors;
  if (rootSessionId === ctx.control.value.rootSessionId && Object.keys(previous).length === Object.keys(supervisors).length
    && Object.keys(supervisors).every((projectId) => supervisors[projectId] === previous[projectId])) return false;
  writeSessionControl(ctx.control.path, value);
  ctx.control.value = value;
  return true;
}

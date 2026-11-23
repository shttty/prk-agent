import type { HostContext } from "../host/host-state.ts";
import { rememberProject } from "./remember-project.ts";

export function backfillProjectRecords(ctx: HostContext): void {
  const oldest = new Map<string, { name: string; timestamp: string; time: number }>();
  for (const entry of [...ctx.host.history.listAll(), ...ctx.host.history.listArchived()]) {
    if (!entry.projectId || !entry.projectName) continue;
    const timestamp = entry.manager.getHeader()?.timestamp;
    if (!timestamp) continue;
    const time = Date.parse(timestamp);
    if (Number.isFinite(time) && time < (oldest.get(entry.projectId)?.time ?? Infinity)) {
      oldest.set(entry.projectId, { name: entry.projectName, timestamp, time });
    }
  }
  for (const [id, { name, timestamp }] of oldest) {
    try { rememberProject(ctx, { id, name }, timestamp); }
    catch (error) { console.error(`Cannot register project ${JSON.stringify(id)}: ${String(error)}`); }
  }
}

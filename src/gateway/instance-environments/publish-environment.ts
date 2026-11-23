import type { HostContext } from "../host/host-state.ts";
import type { EnvironmentRecord, TargetEnvironmentSnapshot } from "./environment-types.ts";

export function publishEnvironment(ctx: HostContext, record: EnvironmentRecord, update: Partial<TargetEnvironmentSnapshot>): void {
  if (ctx.instances.environments.get(record.snapshot.target) !== record) return;
  record.snapshot = { ...record.snapshot, ...update, revision: record.snapshot.revision + 1 };
  const event = { type: "target_environment_changed" as const, target: record.snapshot.target, timestamp: new Date().toISOString(), details: { environment: record.snapshot } };
  for (const listener of [...ctx.events.listeners]) {
    try { void Promise.resolve(listener(event)).catch((error) => console.error("Environment observer failed", error)); }
    catch (error) { console.error("Environment observer failed", error); }
  }
}

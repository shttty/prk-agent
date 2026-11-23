import { randomUUID } from "node:crypto";
import type { HostContext } from "../host/host-state.ts";
import { WireError } from "../wire/create-error.ts";
import type { TargetEnvironmentSnapshot } from "./environment-types.ts";

export function getTargetEnvironment(ctx: HostContext, request: { target: string }): TargetEnvironmentSnapshot {
  if (!ctx.instances.targets.some(({ id }) => id === request.target)) throw new WireError("NOT_FOUND", "Execution target is not configured.");
  let record = ctx.instances.environments.get(request.target);
  if (!record) {
    record = { abort: new AbortController(), snapshot: { target: request.target, streamId: randomUUID(), revision: 0, status: "idle", transferredBytes: 0, totalBytes: 0, percent: 0, bytesPerSecond: 0 } };
    ctx.instances.environments.set(request.target, record);
  }
  return record.snapshot;
}

import type { HostContext } from "../host/host-state.ts";
import { requireConfigured } from "../../config/execution-target/require-configured.ts";
import { WireError } from "../wire/create-error.ts";
import { getTargetEnvironment } from "./get-environment.ts";
import { publishEnvironment } from "./publish-environment.ts";
import { runDeployment } from "./run-deployment.ts";
import type { TargetEnvironmentSnapshot } from "./environment-types.ts";
import type { BunPackagePins } from "../../config/execution-target/validation/bun-package-options.ts";

export function deployTargetEnvironment(ctx: HostContext, request: { target: string; bunPackages?: BunPackagePins }): TargetEnvironmentSnapshot {
  getTargetEnvironment(ctx, request);
  if (ctx.lifecycle.closing) throw new WireError("BUSY", "Gateway is shutting down.");
  const target = ctx.instances.targets.find(({ id }) => id === request.target)!;
  requireConfigured(target);
  if (request.bunPackages && !target.bunPackages) throw new WireError("INVALID_REQUEST", "Configure the instance Bun registry first.");
  const record = ctx.instances.environments.get(request.target)!;
  if (record.pending) {
    if (request.bunPackages) throw new WireError("BUSY", "Instance maintenance is already running.");
    return record.snapshot;
  }
  record.abort = new AbortController();
  const pending = runDeployment(ctx, record, request.bunPackages).catch((error) => {
    publishEnvironment(ctx, record, { status: "failed", bytesPerSecond: 0, error: { code: "DEPLOYMENT_FAILED", message: error instanceof Error ? error.message : String(error) } });
  }).finally(() => { if (record.pending === pending) record.pending = undefined; });
  record.pending = pending;
  publishEnvironment(ctx, record, { status: "checking", transferredBytes: 0, totalBytes: 0, percent: 0, bytesPerSecond: 0, error: undefined });
  return record.snapshot;
}

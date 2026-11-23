import type { HostContext } from "../host/host-state.ts";
import type { EnvironmentRecord, TargetEnvironmentSnapshot } from "./environment-types.ts";
import { planEnvironment } from "./plan-environment.ts";
import { publishEnvironment } from "./publish-environment.ts";
import { prepareTransfer } from "../../remote-extensions/deployment/prepare-transfer.ts";
import { transferArtifact } from "../../remote-extensions/deployment/transfer-artifact.ts";
import { WireError } from "../wire/create-error.ts";
import { planPython } from "./plan-python.ts";
import { managedPythonPaths } from "../../target-environment/python/managed-paths.ts";
import { resolveCacheRoot } from "../../target-environment/python/resolve-cache-root.ts";
import { installPython } from "../../target-environment/python/install-python.ts";
import { pythonBootstrapRemote } from "../../target-environment/python/run-python-bootstrap-command.ts";
import { transferPythonArtifact } from "./transfer-python-artifact.ts";
import { ensureVenv } from "../../target-environment/python/ensure-venv.ts";
import { installUvLauncher } from "../../target-environment/python/install-uv-launcher.ts";
import type { TargetLease } from "../../target-channel/lease/lease-types.ts";
import type { BunPackagePins } from "../../config/execution-target/validation/bun-package-options.ts";
import { prepareBunPackages } from "../../kernel/process/prepare-bun-packages.ts";

export async function runDeployment(ctx: HostContext, record: EnvironmentRecord, pins?: BunPackagePins): Promise<void> {
  const target = ctx.instances.targets.find(({ id }) => id === record.snapshot.target)!;
  let lease: TargetLease | undefined;
  let unsubscribe: (() => void) | undefined;
  let environment;
  let outcome: Partial<TargetEnvironmentSnapshot> = { status: "ready", percent: 100, bytesPerSecond: 0 };
  try {
    environment = await ctx.host.environments.acquire(target.id);
    const signal = AbortSignal.any([environment.signal, record.abort.signal]);
    const transferEnvironment = { ...environment, signal };
    let previousAt = performance.now();
    const acknowledged = (bytes: number) => {
      const now = performance.now();
      const transferredBytes = record.snapshot.transferredBytes + bytes;
      const percent = record.snapshot.totalBytes ? Math.min(99, transferredBytes / record.snapshot.totalBytes * 100) : 0;
      publishEnvironment(ctx, record, { transferredBytes, percent, bytesPerSecond: bytes * 1000 / Math.max(1, now - previousAt) });
      previousAt = now;
    };
    const cacheRoot = resolveCacheRoot(environment.info.home, ctx.host.config.targetCacheRoot);
    const paths = managedPythonPaths(cacheRoot, target.id);
    if (!target.python) {
      const remote = pythonBootstrapRemote(environment);
      const bootstrap = await planPython(ctx.host.artifactStore.directory, environment, signal, paths);
      publishEnvironment(ctx, record, { status: "transferring", totalBytes: bootstrap.reduce((sum, item) => sum + item.transfer.size, 0) });
      previousAt = performance.now();
      for (const item of bootstrap) await transferPythonArtifact(remote, signal, environment.signal, ctx.host.config.codemode.binChunkBytes, item, acknowledged);
      await installPython(remote, signal, paths);
      await ensureVenv(transferEnvironment, paths);
      await installUvLauncher(remote, signal, paths);
    }
    lease = ctx.host.channels.acquire(target.id);
    unsubscribe = lease.onState((state) => { if (state.state === "error") record.abort.abort(new Error(state.error ?? "Target connection lost.")); });
    const plan = await planEnvironment(ctx, target.id, lease, true);
    record.abort.signal.throwIfAborted();
    const missing = [];
    for (const asset of plan.artifacts) if (!asset.cached) missing.push({ asset, transfer: await prepareTransfer(plan.context.storeDir, asset) });
    const totalBytes = record.snapshot.totalBytes + missing.reduce((sum, { transfer }) => sum + transfer.size, 0);
    publishEnvironment(ctx, record, { status: "transferring", totalBytes, bytesPerSecond: 0,
      percent: totalBytes ? Math.min(99, record.snapshot.transferredBytes / totalBytes * 100) : 0 });
    previousAt = performance.now();
    for (const { asset, transfer } of missing) {
      signal.throwIfAborted();
      const sent = await transferArtifact(plan.context, asset, transfer, transferEnvironment, acknowledged);
      if (!sent) publishEnvironment(ctx, record, { totalBytes: record.snapshot.totalBytes - transfer.size });
    }
    signal.throwIfAborted();
    if (pins && target.bunPackages) await prepareBunPackages({ target: target.id, cwd: target.kernel.cwd,
      bun: { storeDir: plan.context.storeDir, acquire: () => ctx.host.channels.acquire(target.id), packages: { ...target.bunPackages, cacheRoot } },
    }, environment, pins, signal);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outcome = { status: "failed", bytesPerSecond: 0, error: { code: error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : record.abort.signal.aborted ? "TARGET_UNREACHABLE" : "DEPLOYMENT_FAILED", message, ...(error instanceof WireError && error.details ? { details: error.details } : {}) } };
  } finally {
    unsubscribe?.();
    try { try { await lease?.release(); } finally { await environment?.release(); } }
    catch (error) { outcome = { status: "failed", bytesPerSecond: 0, error: { code: "DEPLOYMENT_FAILED", message: error instanceof Error ? error.message : String(error) } }; }
    record.pending = undefined;
    publishEnvironment(ctx, record, outcome);
  }
}

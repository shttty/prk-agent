import type { HostContext } from "../host/host-state.ts";
import { WireError } from "../wire/create-error.ts";
import { getTargetEnvironment } from "./get-environment.ts";
import { planEnvironment } from "./plan-environment.ts";
import { publishEnvironment } from "./publish-environment.ts";
import { deployTargetEnvironment } from "./deploy-environment.ts";
import { managedPythonPaths } from "../../target-environment/python/managed-paths.ts";
import { resolveCacheRoot } from "../../target-environment/python/resolve-cache-root.ts";
import { pythonBootstrapRemote, runPythonBootstrapCommand } from "../../target-environment/python/run-python-bootstrap-command.ts";
import type { TargetLease } from "../../target-channel/lease/lease-types.ts";

/** Session start (create, wake, reload) brings the instance environment to the current version first: a cache-only
 * check, and when anything is missing the instance's one deployment, started or joined, awaited until it settles. */
export async function ensureEnvironment(ctx: HostContext, target: string): Promise<void> {
  getTargetEnvironment(ctx, { target });
  const record = ctx.instances.environments.get(target)!;
  if (!record.pending && await isCurrent(ctx, target)) {
    if (!record.pending && record.snapshot.status !== "ready") publishEnvironment(ctx, record, { status: "ready", transferredBytes: 0, totalBytes: 0, percent: 100, bytesPerSecond: 0, error: undefined });
    return;
  }
  deployTargetEnvironment(ctx, { target });
  // A deployment that settles may be followed at once by another (a manual retry): wait for whichever is last.
  while (record.pending) await record.pending;
  if (record.snapshot.status === "ready") return;
  throw new WireError("DEPLOYMENT_FAILED", `Instance environment deployment failed: ${record.snapshot.error?.message ?? record.snapshot.status}`, { target, environment: record.snapshot });
}

/** Builders and the managed-Python check answer from caches only; ENVIRONMENT_REQUIRED from them means "not current". */
async function isCurrent(ctx: HostContext, target: string): Promise<boolean> {
  let lease: TargetLease | undefined;
  try {
    const instance = ctx.instances.targets.find(({ id }) => id === target)!;
    if (!instance.python) {
      const environment = await ctx.host.environments.acquire(target);
      try {
        const paths = managedPythonPaths(resolveCacheRoot(environment.info.home, ctx.host.config.targetCacheRoot), target);
        const check = await runPythonBootstrapCommand(pythonBootstrapRemote(environment), environment.signal, ["/bin/sh", "-c",
          '[ -x "$1" ] && [ -x "$2" ] && [ -f "$3" ] && [ -x "$4" ] && [ -x "$5" ]', "prk-python-check", paths.python, paths.uv, paths.archive, paths.venvPython, paths.uvLauncher]);
        if (check.exitCode !== 0) return false;
      } finally { await environment.release(); }
    }
    lease = ctx.host.channels.acquire(target);
    return (await planEnvironment(ctx, target, lease)).artifacts.every(({ cached }) => cached);
  } catch (error) {
    if (error instanceof WireError && error.code === "ENVIRONMENT_REQUIRED") return false;
    throw error;
  } finally { await lease?.release(); }
}

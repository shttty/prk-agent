import type { HostContext } from "../host/host-state.ts";
import { WireError } from "../wire/create-error.ts";
import { getTargetEnvironment } from "./get-environment.ts";
import { planEnvironment } from "./plan-environment.ts";
import { publishEnvironment } from "./publish-environment.ts";
import { managedPythonPaths } from "../../target-environment/python/managed-paths.ts";
import { resolveCacheRoot } from "../../target-environment/python/resolve-cache-root.ts";
import { pythonBootstrapRemote, runPythonBootstrapCommand } from "../../target-environment/python/run-python-bootstrap-command.ts";
import type { TargetLease } from "../../target-channel/lease/lease-types.ts";

export async function requireEnvironment(ctx: HostContext, target: string): Promise<void> {
  getTargetEnvironment(ctx, { target });
  const record = ctx.instances.environments.get(target)!;
  const required = () => new WireError("ENVIRONMENT_REQUIRED", "Deploy the instance environment before starting this session.", { target, environment: record.snapshot });
  if (record.pending) throw required();
  let lease: TargetLease | undefined;
  try {
    const instance = ctx.instances.targets.find(({ id }) => id === target)!;
    if (!instance.python) {
      const environment = await ctx.host.environments.acquire(target);
      try {
        const paths = managedPythonPaths(resolveCacheRoot(environment.info.home, ctx.host.config.targetCacheRoot), target);
        const check = await runPythonBootstrapCommand(pythonBootstrapRemote(environment), environment.signal, ["/bin/sh", "-c",
          '[ -x "$1" ] && [ -x "$2" ] && [ -f "$3" ] && [ -x "$4" ] && [ -x "$5" ]', "prk-python-check", paths.python, paths.uv, paths.archive, paths.venvPython, paths.uvLauncher]);
        if (check.exitCode !== 0) throw required();
      } finally { await environment.release(); }
    }
    lease = ctx.host.channels.acquire(target);
    const plan = await planEnvironment(ctx, target, lease);
    if (record.pending || plan.artifacts.some(({ cached }) => !cached)) throw required();
    if (record.snapshot.status !== "ready") publishEnvironment(ctx, record, { status: "ready", transferredBytes: 0, totalBytes: 0, percent: 100, bytesPerSecond: 0, error: undefined });
  } catch (error) {
    if (error instanceof WireError && error.code === "ENVIRONMENT_REQUIRED") {
      if (!record.pending) publishEnvironment(ctx, record, { status: "idle", transferredBytes: 0, totalBytes: 0, percent: 0, bytesPerSecond: 0, error: undefined });
      throw required();
    }
    throw error;
  } finally { await lease?.release(); }
}

import { posix } from "node:path";
import type { ExecutionTarget } from "../../config/execution-target/target-types.ts";
import type { TargetEnvironmentLease } from "../connection/connection-types.ts";
import { managedPythonPaths, type ManagedPythonPaths } from "./managed-paths.ts";
import { resolveCacheRoot } from "./resolve-cache-root.ts";
import { pythonBootstrapRemote, runPythonBootstrapCommand } from "./run-python-bootstrap-command.ts";

export interface PythonRuntime {
  readonly python: string;
  readonly basePython: string;
  readonly env: Record<string, string>;
}
export type PythonEnvironmentPolicy = (target: Pick<ExecutionTarget, "id" | "python" | "pythonIndexUrl">,
  paths?: ManagedPythonPaths) => Record<string, string>;

/** Runtime admission only reads deployment caches; creation belongs to explicit deployment. */
export async function resolvePythonRuntime(environment: TargetEnvironmentLease, target: Pick<ExecutionTarget, "id" | "python" | "pythonIndexUrl">,
  configuredRoot?: string, environmentPolicy?: PythonEnvironmentPolicy): Promise<PythonRuntime> {
  if (target.python) return { python: target.python, basePython: target.python, env: environmentPolicy?.(target) ?? {} };
  const paths = managedPythonPaths(resolveCacheRoot(environment.info.home, configuredRoot), target.id);
  const result = await runPythonBootstrapCommand(pythonBootstrapRemote(environment), environment.signal,
    ["/bin/sh", "-c", 'test -x "$1" && test -x "$2" && test -x "$3" && printf %s "$PATH"', "prk-python-runtime", paths.python, paths.venvPython, paths.uv]);
  if (result.exitCode !== 0) throw Object.assign(new Error(`Managed Python for instance ${target.id} is missing; deploy its environment first.`), { code: "ENVIRONMENT_REQUIRED", details: { target: target.id } });
  const env = environmentPolicy?.(target, paths) ?? {};
  return { python: paths.venvPython, basePython: paths.python,
    env: { ...env, PATH: `${posix.dirname(paths.uvLauncher)}:${posix.dirname(paths.venvPython)}:${result.output}`, VIRTUAL_ENV: paths.venv } };
}

import type { TargetEnvironmentLease } from "../connection/connection-types.ts";
import type { ManagedPythonPaths } from "./managed-paths.ts";
import { pythonBootstrapRemote, runPythonBootstrapCommand } from "./run-python-bootstrap-command.ts";

export async function ensureVenv(environment: TargetEnvironmentLease, paths: ManagedPythonPaths, onLog?: (text: string) => void): Promise<void> {
  const result = await runPythonBootstrapCommand(pythonBootstrapRemote(environment), environment.signal, ["/bin/sh", "-c",
    'if [ -x "$1" ]; then exit 0; fi\nexec env UV_OFFLINE=1 UV_CACHE_DIR="$2" "$3" --offline --no-config venv --allow-existing --python "$4" "$5"',
    "prk-ensure-venv", paths.venvPython, paths.cache, paths.uv, paths.python, paths.venv]);
  if (result.output) onLog?.(result.output);
  if (result.exitCode !== 0) throw new Error(`Offline instance Python venv creation failed: ${result.output}`);
}

import type { RemoteExecutionEnv } from "@earendil-works/pi-env";
import { pathToFileURL } from "node:url";
import { MANAGED_PYTHON } from "../../artifacts/python/python-release.ts";
import type { ManagedPythonPaths } from "./managed-paths.ts";
import { runPythonBootstrapCommand } from "./run-python-bootstrap-command.ts";

export async function installPython(remote: RemoteExecutionEnv, signal: AbortSignal, paths: ManagedPythonPaths): Promise<void> {
  const result = await runPythonBootstrapCommand(remote, signal, ["env", "UV_OFFLINE=1",
    `UV_PYTHON_INSTALL_MIRROR=${pathToFileURL(paths.mirror).href}`,
    `UV_PYTHON_INSTALL_DIR=${paths.installDir}`, `UV_CACHE_DIR=${paths.cache}`,
    paths.uv, "--no-config", "-v", "python", "install", "--no-bin", "--no-registry", MANAGED_PYTHON.distribution]);
  if (result.exitCode !== 0) throw new Error(`Offline managed Python installation failed: ${result.output}`);
  if (result.output.trim()) console.error(`[managed Python, UV_OFFLINE=1] ${result.output.trim()}`);
}

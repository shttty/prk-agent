import { nodePlatform } from "@earendil-works/pi-env";
import { MANAGED_PYTHON, readPythonRelease } from "../../artifacts/python/python-release.ts";
import { prepareTransfer } from "../../remote-extensions/deployment/prepare-transfer.ts";
import type { DeploymentArtifact } from "../../remote-extensions/deployment/deployment-types.ts";
import type { TargetEnvironmentLease } from "../../target-environment/connection/connection-types.ts";
import type { ManagedPythonPaths } from "../../target-environment/python/managed-paths.ts";
import { pythonBootstrapRemote, runPythonBootstrapCommand } from "../../target-environment/python/run-python-bootstrap-command.ts";
import { checkPythonPlatform } from "../../target-environment/python/check-python-platform.ts";

export interface PythonTransfer {
  asset: DeploymentArtifact;
  transfer: { path: string; size: number; gzip: boolean };
  executable: boolean;
}

export async function planPython(storeDir: string, environment: TargetEnvironmentLease, signal: AbortSignal, paths: ManagedPythonPaths): Promise<PythonTransfer[]> {
  const { platform, arch } = nodePlatform(environment.info);
  if (platform !== "linux" || arch !== "x64") throw new Error(`Unsupported managed Python platform: ${platform}/${arch}; requires Linux x86_64.`);
  const entries = readPythonRelease(storeDir);
  const remote = pythonBootstrapRemote(environment);
  const libc = await runPythonBootstrapCommand(remote, signal, ["getconf", "GNU_LIBC_VERSION"]);
  checkPythonPlatform(environment.info, libc.exitCode === 0 ? libc.output : "", entries.python.minGlibc);
  const missing: PythonTransfer[] = [];
  for (const [key, path, executable] of [["uv", paths.uv, true], ["python", paths.archive, false]] as const) {
    const check = await runPythonBootstrapCommand(remote, signal, ["test", executable ? "-x" : "-f", path]);
    if (check.exitCode === 0) continue;
    const asset: DeploymentArtifact = { name: MANAGED_PYTHON[key].name, ...entries[key], kind: "tool", path, cached: false };
    missing.push({ asset, transfer: await prepareTransfer(storeDir, asset), executable });
  }
  return missing;
}

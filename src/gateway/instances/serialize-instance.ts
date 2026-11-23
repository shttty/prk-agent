import type { ExecutionTarget } from "../../config/execution-target/target-types.ts";
import type { ExecutionTargetConfig } from "../../config/execution-target/target-types.ts";

export function targetConfig(target: ExecutionTarget): ExecutionTargetConfig {
  return {
    id: target.id,
    label: target.label,
    local: target.local === true,
    ...(target.sshCommand === undefined ? {} : { sshCommand: target.sshCommand }),
    ...(target.python === undefined ? {} : { python: target.python }),
    ...(target.pythonIndexUrl === undefined ? {} : { pythonIndexUrl: target.pythonIndexUrl }),
    ...(target.bunPackages === undefined ? {} : { bunPackages: target.bunPackages }),
    tags: [...target.tags],
    cwd: target.kernel.cwd,
    ...(target.kernel.executionTimeoutMs === undefined ? {} : { executionTimeoutMs: target.kernel.executionTimeoutMs }),
    ...(target.kernel.kernelOptions === undefined ? {} : { kernel: target.kernel.kernelOptions }),
    ...(target.capabilities === undefined ? {} : { capabilities: { ...target.capabilities } }),
    ...(target.customMetrics === undefined ? {} : { customMetrics: target.customMetrics }),
  };
}

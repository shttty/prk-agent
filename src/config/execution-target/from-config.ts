import { DEFAULT_LIMITS_OPTIONS } from "../limits/limits-options.ts";
import type { LimitsOptions } from "../limits/limits-options.ts";
import { DEFAULT_KERNEL_OPTIONS } from "../kernel/kernel-options.ts";
import type { KernelOptions } from "../kernel/kernel-options.ts";
import type { ExecutionTargetConfig } from "./target-types.ts";
import type { ExecutionTarget } from "./target-types.ts";
import { parseInstanceConfig } from "./parse-instance-config.ts";

export function executionTargetFromConfig(config: ExecutionTargetConfig, limits: LimitsOptions = DEFAULT_LIMITS_OPTIONS, kernelDefaults: KernelOptions = DEFAULT_KERNEL_OPTIONS): ExecutionTarget {
  return parseInstanceConfig([config], limits, kernelDefaults)[0]!;
}

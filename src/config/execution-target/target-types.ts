import type { KernelOptions } from "../kernel/kernel-options.ts";
import type { CustomMetric } from "../custom-metrics/custom-metrics-options.ts";
import type { CapabilitySwitches } from "../capabilities/capability-types.ts";
import type { BunRegistry } from "./validation/bun-package-options.ts";

export interface ExecutionTargetConfig {
  /** Stable internal routing identity; never a user-facing environment name. */
  readonly id: string;
  /** Required unique user-facing instance display name. */
  readonly label: string;
  /** Local targets use an owned daemon; remote targets use the command verbatim. */
  readonly local?: boolean;
  readonly sshCommand?: string;
  readonly python?: string;
  readonly pythonIndexUrl?: string;
  readonly bunPackages?: BunRegistry;
  readonly tags?: readonly string[];
  /** Absolute POSIX path on the instance; required. */
  readonly cwd: string;
  readonly executionTimeoutMs?: number;
  readonly kernel?: Partial<KernelOptions>;
  readonly capabilities?: CapabilitySwitches;
  readonly customMetrics?: readonly CustomMetric[];
}

export interface ExecutionTargetEdit extends Omit<ExecutionTargetConfig, "cwd" | "capabilities" | "customMetrics"> {
  /** Omitted keeps the saved cwd. */
  readonly cwd?: string;
}

export interface ExecutionTarget {
  readonly id: string;
  readonly label: string;
  readonly local: boolean;
  readonly sshCommand?: string;
  readonly python?: string;
  readonly pythonIndexUrl?: string;
  readonly bunPackages?: BunRegistry;
  readonly kernel: {
    readonly target: string;
    readonly cwd: string;
    readonly kernelOptions: KernelOptions;
    readonly executionTimeoutMs?: number;
  };
  readonly tags: readonly string[];
  readonly capabilities?: CapabilitySwitches;
  readonly customMetrics?: readonly CustomMetric[];
}

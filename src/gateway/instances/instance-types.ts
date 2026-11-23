import type { KernelOptions } from "../../config/kernel/kernel-options.ts";
import type { CustomMetric } from "../../config/custom-metrics/custom-metrics-options.ts";
import type { ConfigurationIssue } from "../../config/execution-target/configuration-issue.ts";
import type { TargetEnvironmentSnapshot } from "../instance-environments/environment-types.ts";
import type { BunRegistry } from "../../config/execution-target/validation/bun-package-options.ts";

export interface PublicExecutionTarget {
  readonly id: string;
  readonly label: string;
  readonly local: boolean;
  readonly tags: readonly string[];
  readonly python?: string;
  readonly configurationIssue?: ConfigurationIssue;
  readonly environment?: TargetEnvironmentSnapshot;
}

export interface EditableExecutionTarget extends PublicExecutionTarget {
  readonly sshCommand?: string;
  readonly pythonIndexUrl?: string;
  readonly bunPackages?: BunRegistry;
  readonly cwd?: string;
  readonly executionTimeoutMs?: number;
  readonly kernel?: KernelOptions;
  readonly customMetrics?: readonly CustomMetric[];
}

export interface TargetConnection {
  readonly local: boolean;
  readonly sshCommand?: string;
  readonly python?: string;
  readonly cwd?: string;
}

export interface InspectTargetResult {
  readonly hostname: string;
  readonly platform: string;
  readonly home: string;
  readonly pythonCandidates: readonly string[];
  readonly python?: { readonly path: string; readonly version: string };
}

export interface AbsoluteListing {
  readonly path: string;
  readonly atRoot: boolean;
  readonly entries: readonly { readonly name: string; readonly type: "directory" | "file"; readonly path: string }[];
  readonly truncated: boolean;
}

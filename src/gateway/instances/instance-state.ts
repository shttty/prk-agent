import type { ExecutionTarget } from "../../config/execution-target/target-types.ts";
import type { PublicExecutionTarget } from "./instance-types.ts";
import type { EnvironmentRecord } from "../instance-environments/environment-types.ts";

export interface InstanceState {
  targetConfigPath: string;
  targets: ExecutionTarget[];
  publicTargets: readonly PublicExecutionTarget[];
  environments: Map<string, EnvironmentRecord>;
}

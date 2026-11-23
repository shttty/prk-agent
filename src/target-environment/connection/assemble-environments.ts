import type { TargetEnvironmentOptions, TargetEnvironments } from "./connection-types.ts";
import type { EnvironmentsContext } from "./connection-state.ts";
import { acquireEnvironment } from "./acquire-environment.ts";

export function createTargetEnvironments(options: TargetEnvironmentOptions): TargetEnvironments {
  const ctx: EnvironmentsContext = { options, records: new Map() };
  return { acquire: (id) => acquireEnvironment(ctx, id) };
}

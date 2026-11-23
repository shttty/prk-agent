import type { CapabilityChanges } from "./capability-types.ts";
import { switchValues } from "./validate-capability-switch-values.ts";
export function isCapabilityChanges(value: unknown): value is CapabilityChanges {
  return switchValues(value, true);
}

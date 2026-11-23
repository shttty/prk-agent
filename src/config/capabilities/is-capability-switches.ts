import type { CapabilitySwitches } from "./capability-types.ts";
import { switchValues } from "./validate-capability-switch-values.ts";
export function isCapabilitySwitches(value: unknown): value is CapabilitySwitches {
  return switchValues(value, false);
}

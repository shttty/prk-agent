import type { CapabilitySwitches } from "./capability-types.ts";
import { isCapabilitySwitches } from "./is-capability-switches.ts";
export function parseCapabilitySwitches(value: unknown): CapabilitySwitches {
  if (!isCapabilitySwitches(value)) throw new Error("Invalid PRK configuration: session.capabilities must map tool, kernel, skill, group, or lazy IDs to booleans; the local tools group uses session.localTools.");
  return { ...value };
}

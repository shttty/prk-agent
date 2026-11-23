import { capabilityId } from "./validate-capability-id.ts";
import { LOCAL_TOOLS_CAPABILITY } from "./capability-constants.ts";
export function switchValues(value: unknown, nullable: boolean): boolean {
  return !!value && typeof value === "object" && !Array.isArray(value)
    && Object.entries(value).every(([id, enabled]) => capabilityId(id) && id !== LOCAL_TOOLS_CAPABILITY
      && (typeof enabled === "boolean" || (nullable && enabled === null)));
}

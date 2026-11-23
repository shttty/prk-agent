import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import { isCapabilityBatch } from "../../../config/capabilities/is-capability-batch.ts";
import { object } from "../is-record.ts";
import { keys } from "../fields/has-only-fields.ts";
import { routingIdentifier } from "../fields/is-routing-identifier.ts";
import { invalid } from "./reject-invalid-request.ts";

export function validateCapabilityParams(value: { method: string }, p: Record<string, unknown>, limits: LimitsOptions): boolean {
  if (value.method === "capabilitiesList") {
    if (!keys(p, ["instance"]) || (p.instance !== undefined && !routingIdentifier(p.instance, limits))) return invalid();
  } else if (value.method === "capabilitiesRefresh") {
    if (!keys(p, ["instance"]) || (p.instance !== undefined && !routingIdentifier(p.instance, limits))) return invalid();
  } else if (value.method === "capabilitiesChange") {
    if ("terminal" in p) {
      if (!keys(p, ["terminal"]) || !object(p.terminal)) return invalid();
      // Validate the partial terminal settings against current options in the host.
    } else if ("instance" in p) {
      if (!keys(p, ["instance", "changes"]) || !routingIdentifier(p.instance, limits) || !isCapabilityBatch(p)) return invalid();
    } else if (!keys(p, ["changes"]) || !isCapabilityBatch(p)) return invalid();
  } else return false;
  return true;
}

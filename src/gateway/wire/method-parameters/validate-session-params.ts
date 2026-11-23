import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import { keys } from "../fields/has-only-fields.ts";
import { fieldText } from "../fields/is-field-text.ts";
import { routingIdentifier } from "../fields/is-routing-identifier.ts";
import { label } from "../fields/is-label.ts";
import { sessionScoped } from "./method-constants.ts";
import { invalid } from "./reject-invalid-request.ts";

export const optionalLabel = (value: unknown, limits: LimitsOptions) => typeof value === "string" && value.length <= limits.labelChars && !/\p{Cc}/u.test(value);

export function validateSessionParams(value: { method: string }, p: Record<string, unknown>, limits: LimitsOptions): boolean {
  if (value.method === "manageSession") {
    if (!routingIdentifier(p.sessionId, limits) || typeof p.action !== "string") return invalid();
    if (p.action === "transfer") {
      if (!keys(p, ["sessionId", "action", "owner"]) || !routingIdentifier(p.owner, limits)) return invalid();
    } else if (p.action === "upgrade") {
      if (!keys(p, ["sessionId", "action"])) return invalid();
    } else return invalid();
  } else if (value.method === "setSessionRoot" || value.method === "setProjectSupervisor") {
    if (!keys(p, ["sessionId"]) || !routingIdentifier(p.sessionId, limits)) return invalid();
  } else if (sessionScoped.includes(value.method)) {
    if (!keys(p, ["sessionId"]) || !routingIdentifier(p.sessionId, limits)) return invalid();
  } else if (value.method === "renameSession") {
    if (!keys(p, ["sessionId", "label"]) || !routingIdentifier(p.sessionId, limits) || !label(p.label, limits)) return invalid();
  } else if (value.method === "recoverSession") {
    if (!keys(p, ["sessionId", "mode", "target", "cwd"]) || !routingIdentifier(p.sessionId, limits) || (p.mode !== "new" && p.mode !== "auto")
      || (p.mode === "new" ? !routingIdentifier(p.target, limits) : p.target !== undefined || p.cwd !== undefined)
      || (p.cwd !== undefined && !fieldText(p.cwd, limits.cwdChars))) return invalid();
  } else return false;
  return true;
}

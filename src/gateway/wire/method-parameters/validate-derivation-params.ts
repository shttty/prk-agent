import { parseDerivationConfig } from "../../../config/derivation/parse-config.ts";
import { WireError } from "../create-error.ts";
import { keys } from "../fields/has-only-fields.ts";
import { object } from "../is-record.ts";
import { invalid } from "./reject-invalid-request.ts";

export function validateDerivationParams(value: { method: string }, p: Record<string, unknown>): boolean {
  if (value.method === "derivationGet") {
    if (!keys(p, [])) return invalid();
  } else if (value.method === "derivationSet") {
    if (!keys(p, ["derivation"]) || !object(p.derivation)) return invalid();
    try { parseDerivationConfig(p); }
    catch (error) { throw new WireError("INVALID_REQUEST", error instanceof Error ? error.message : "Invalid derivation configuration."); }
  } else return false;
  return true;
}

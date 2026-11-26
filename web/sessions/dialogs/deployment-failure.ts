import type { EnvironmentFailure } from "../../instances/environment/environment-types.ts";
import { isRecord } from "../../workbench/payloads/is-record.ts";
import type { RequestError } from "../../workbench/store/requests/request-error.ts";

/** The deployment's own error rides in the refusal's details (`environment.error`); the refusal's code and message stand in when it is missing. */
export function deploymentFailure(refusal: RequestError): EnvironmentFailure {
  const environment = refusal.details?.environment;
  const error = isRecord(environment) ? environment.error : undefined;
  if (isRecord(error) && typeof error.message === "string") {
    return { kind: "deploy", ...(typeof error.code === "string" ? { code: error.code } : {}), message: error.message, ...(isRecord(error.details) ? { details: error.details } : {}) };
  }
  return { kind: "deploy", ...(refusal.code ? { code: refusal.code } : {}), message: refusal.message };
}

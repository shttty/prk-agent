import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import type { WebRecoverSessionRequest } from "../../gateway-connection/client-types.ts";
import { HttpError } from "../../request/create-error.ts";
import { nativeRequest } from "../../request/validate-wire-params.ts";
import type { RecoveryMode } from "../../../gateway/wire/wire-types.ts";

export function recoverSessionRequest(limits: LimitsOptions, body: Record<string, unknown>, sessionId: string): WebRecoverSessionRequest {
  if (typeof body.mode !== "string" || Object.keys(body).some((key) => !["mode", "target", "cwd"].includes(key))) {
    throw new HttpError(400, "Session recovery accepts mode auto, or mode new with target and optional cwd.");
  }
  const validated = nativeRequest(limits, body, "recoverSession", sessionId);
  return {
    mode: validated.mode as RecoveryMode,
    ...(validated.target === undefined ? {} : { target: validated.target as string }),
    ...(validated.cwd === undefined ? {} : { cwd: validated.cwd as string }),
  };
}

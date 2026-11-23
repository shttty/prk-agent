import type { LimitsOptions } from "../../config/limits/limits-options.ts";
import { nativeRequest } from "./validate-wire-params.ts";
import { exactKeys } from "./inspect-request-keys.ts";
import { HttpError } from "./create-error.ts";

export function exactRequest(limits: LimitsOptions, body: Record<string, unknown>, method: Parameters<typeof nativeRequest>[2], keys: readonly string[], message: string, sessionId?: string): Record<string, unknown> {
  if (!exactKeys(body, keys)) throw new HttpError(400, message);
  return nativeRequest(limits, body, method, sessionId);
}

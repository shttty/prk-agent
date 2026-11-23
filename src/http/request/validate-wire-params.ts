import type { LimitsOptions } from "../../config/limits/limits-options.ts";
import type { Method } from "../../gateway/wire/wire-types.ts";
import { validateRequest } from "../../gateway/wire/validate-request.ts";
import { WireError } from "../../gateway/wire/create-error.ts";
import { HttpError } from "./create-error.ts";

export function nativeRequest(limits: LimitsOptions, body: Record<string, unknown>, method: Method, sessionId?: string): Record<string, unknown> {
  try {
    if (sessionId !== undefined && Object.hasOwn(body, "sessionId")) throw new HttpError(400, "Session identity belongs in the route, not the JSON body.");
    if (method === "send" && Object.hasOwn(body, "source")) throw new HttpError(400, "Send source is assigned by the HTTP transport.");
    const params = sessionId === undefined ? body : { ...body, sessionId };
    const validated = validateRequest({ v: 1, id: 1, method, params }, limits).params;
    if (sessionId === undefined) return validated;
    const { sessionId: _routing, ...rest } = validated;
    return rest;
  } catch (error: unknown) {
    if (error instanceof WireError) throw new HttpError(400, error.message, error.code, error.details);
    throw error;
  }
}

import type { LimitsOptions } from "../../config/limits/limits-options.ts";
import { HttpError } from "../request/create-error.ts";
import { decodeRouteIdentity } from "../request/decode-route-identity.ts";

export function routeTargetPath(limits: LimitsOptions, pathname: string): string | undefined {
  const prefix = "/api/targets/";
  if (!pathname.startsWith(prefix)) return undefined;
  const rest = pathname.slice(prefix.length);
  if (!rest || rest.includes("/")) throw new HttpError(404, "Endpoint not found.");
  return decodeRouteIdentity(limits, rest);
}

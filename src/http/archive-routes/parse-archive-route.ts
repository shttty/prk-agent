import type { LimitsOptions } from "../../config/limits/limits-options.ts";
import { HttpError } from "../request/create-error.ts";
import { decodeRouteIdentity } from "../request/decode-route-identity.ts";

export function routeArchivePath(limits: LimitsOptions, pathname: string): { group: string; action: "unarchive" | "purge" } | undefined {
  const prefix = "/api/archive/";
  if (!pathname.startsWith(prefix)) return undefined;
  const [rawGroup, action, extra] = pathname.slice(prefix.length).split("/");
  if (!rawGroup || extra !== undefined || (action !== "unarchive" && action !== "purge")) throw new HttpError(404, "Endpoint not found.");
  return { group: decodeRouteIdentity(limits, rawGroup), action };
}

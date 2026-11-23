import type { LimitsOptions } from "../../config/limits/limits-options.ts";
import { HttpError } from "./create-error.ts";

export function decodeRouteIdentity(limits: LimitsOptions, value: string, maxChars = limits.identityChars): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    throw new HttpError(400, "Route identity contains invalid percent encoding.");
  }
  if (decoded.trim().length === 0 || decoded.length > maxChars || decoded === "." || decoded === ".."
    || decoded.includes("\0") || decoded.includes("/") || decoded.includes("\\") || /\p{Cc}/u.test(decoded)) {
    throw new HttpError(400, "Route identity is invalid.");
  }
  return decoded;
}

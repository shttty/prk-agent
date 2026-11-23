import type { LimitsOptions } from "../../config/limits/limits-options.ts";

export function validSessionCwd(value: unknown, limits: LimitsOptions): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= limits.cwdChars
    && !value.includes("\0") && !/\p{Cc}/u.test(value);
}

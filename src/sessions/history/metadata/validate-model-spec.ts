import type { LimitsOptions } from "../../../config/limits/limits-options.ts";

export function modelSpec(value: unknown, limits: LimitsOptions): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= limits.modelChars
    && value.includes("/") && !/\s/u.test(value) && !/\p{Cc}/u.test(value);
}

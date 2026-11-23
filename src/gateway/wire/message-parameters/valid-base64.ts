import type { LimitsOptions } from "../../../config/limits/limits-options.ts";

export function validBase64(value: unknown, limits: LimitsOptions): value is string {
  return typeof value === "string" && value.length <= Math.ceil(limits.attachmentBytes / 3) * 4 && value.length % 4 === 0
    && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value);
}

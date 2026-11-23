import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import { invalid } from "../reject-invalid-history.ts";

export function validateMetadataSessionId(value: unknown, detail: string, limits: LimitsOptions): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > limits.identityChars || /\p{Cc}/u.test(value)) invalid(`${detail} at /sessionId`);
}

import type { LimitsOptions } from "../../limits/limits-options.ts";
import { invalid } from "../validation/reject-invalid-target.ts";

export function normalizeLabel(value: unknown, index: number, limits: LimitsOptions): string {
  if (typeof value !== "string" || value.length > limits.labelChars || /\p{Cc}/u.test(value)) {
    invalid(`instance ${index} has an invalid label; use at most ${limits.labelChars} characters without control characters`);
  }
  const label = value.trim();
  if (label.length === 0) invalid(`instance ${index} has a required non-empty label`);
  return label;
}

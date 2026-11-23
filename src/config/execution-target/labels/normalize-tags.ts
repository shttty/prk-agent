import type { LimitsOptions } from "../../limits/limits-options.ts";
import { invalid } from "../validation/reject-invalid-target.ts";

export function normalizeTags(value: unknown, index: number, limits: LimitsOptions): readonly string[] {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > limits.tagsMax) {
    invalid(`instance ${index} has invalid tags; use at most ${limits.tagsMax} values`);
  }
  const tags = new Set<string>();
  for (const raw of value) {
    if (typeof raw !== "string" || raw.length > limits.tagChars || /\p{Cc}/u.test(raw)) {
      invalid(`instance ${index} has an invalid tag; use 1–${limits.tagChars} characters without control characters`);
    }
    const tag = raw.trim();
    if (tag.length === 0) invalid(`instance ${index} has an empty tag`);
    tags.add(tag);
  }
  return Object.freeze([...tags]);
}

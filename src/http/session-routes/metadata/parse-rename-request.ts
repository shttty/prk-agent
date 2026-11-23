import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import { exactKeys } from "../../request/inspect-request-keys.ts";
import { HttpError } from "../../request/create-error.ts";

export function renameSessionRequest(limits: LimitsOptions, body: Record<string, unknown>): string {
  if (!exactKeys(body, ["label"])) throw new HttpError(400, "Session rename accepts only a label.");
  const value = body.label;
  if (typeof value !== "string" || value.trim().length === 0 || value.length > limits.labelChars || /\p{Cc}/u.test(value)) {
    throw new HttpError(400, `Session label must be non-empty after trimming, at most ${limits.labelChars} characters, and contain no control characters.`);
  }
  return value.trim();
}

import { WireError } from "../../../gateway/wire/create-error.ts";

export function milliseconds(seconds: number | undefined, fallback: number, maximum: number, field: string): number {
  if (seconds === undefined) return fallback;
  if (!Number.isFinite(seconds) || seconds < 0 || seconds * 1000 > maximum) {
    throw new WireError("INVALID_REQUEST", `${field} must be between 0 and ${maximum / 1000} seconds.`);
  }
  return Math.round(seconds * 1000);
}

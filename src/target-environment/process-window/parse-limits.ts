import DEFAULT_LIMITS from "./window-limits.json" with { type: "json" };
import type { ProcessWindowLimits } from "./window-state.ts";

export function parseProcessWindowLimits(value: unknown = {}): ProcessWindowLimits {
  if (value === null || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).some((key) => !Object.hasOwn(DEFAULT_LIMITS, key))) {
    throw Object.assign(new Error("Invalid processWindow: expected only maxRequests, maxBytes and maxFrameBytes."), { code: "INVALID_REQUEST" });
  }
  const limits = { ...DEFAULT_LIMITS, ...value };
  if (Object.values(limits).some((limit) => !Number.isSafeInteger(limit) || limit <= 0)
    || limits.maxFrameBytes > limits.maxBytes) {
    throw Object.assign(new Error("Invalid processWindow: positive safe integers and maxFrameBytes <= maxBytes required."), { code: "INVALID_REQUEST" });
  }
  return Object.freeze(limits);
}

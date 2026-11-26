export type Payload = Record<string, unknown>;

/** Narrows opaque wire data (tool arguments and results, plugin output) to a plain object. */
export function isPayload(value: unknown): value is Payload {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

import { DEFAULT_TRACE_OPTIONS, type TraceOptions } from "./trace-options.ts";

export function parseTraceOptions(value: unknown): TraceOptions {
  if (value === undefined) return { ...DEFAULT_TRACE_OPTIONS };
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid PRK configuration: trace must be an object.");
  }
  const options = { ...DEFAULT_TRACE_OPTIONS };
  for (const [key, option] of Object.entries(value)) {
    if (!Object.hasOwn(options, key)) throw new Error(`Invalid PRK configuration: unsupported trace.${key}.`);
    if (typeof option !== "number" || !Number.isSafeInteger(option) || option < 1) {
      throw new Error(`Invalid PRK configuration: trace.${key} must be a positive safe integer.`);
    }
    Object.assign(options, { [key]: option });
  }
  return options;
}

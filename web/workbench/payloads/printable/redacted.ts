import { isRecord } from "../is-record.ts";

/** A copy of `value` cut to a displayable size: depth, array length and key count are capped. */
export function redacted(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[已省略]";
  if (Array.isArray(value)) return value.slice(0, 80).map((item) => redacted(item, depth + 1));
  if (isRecord(value)) {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value).slice(0, 100)) output[key] = redacted(item, depth + 1);
    return output;
  }
  return value;
}

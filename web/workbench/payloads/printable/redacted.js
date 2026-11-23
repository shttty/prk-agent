import { isRecord } from "../is-record.js";
export function redacted(value, depth = 0) {
  if (depth > 5) return "[已省略]";
  if (Array.isArray(value)) return value.slice(0, 80).map((item) => redacted(item, depth + 1));
  if (isRecord(value)) {
    const output = {};
    for (const [key, item] of Object.entries(value).slice(0, 100)) output[key] = redacted(item, depth + 1);
    return output;
  }
  return value;
}


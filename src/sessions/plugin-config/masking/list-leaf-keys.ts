import { isObject } from "../values/is-config-object.ts";

/** Every leaf dot path of a JSON object (arrays are leaves). */
export function leaves(value: unknown, prefix = ""): string[] {
  if (!isObject(value)) return prefix ? [prefix] : [];
  return Object.entries(value).flatMap(([key, child]) => leaves(child, prefix ? `${prefix}.${key}` : key));
}

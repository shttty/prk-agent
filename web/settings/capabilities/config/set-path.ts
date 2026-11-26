import type { ConfigValues } from "../capability-types.ts";

/** A copy of `object` with the dot path `key` set to `value` (objects on the way are created where missing). */
export function setPath(object: ConfigValues | undefined, key: string, value: unknown): ConfigValues {
  const parts = key.split(".");
  const next: ConfigValues = structuredClone(object ?? {});
  let node = next;
  for (const part of parts.slice(0, -1)) {
    const child = node[part];
    if (child === null || typeof child !== "object") node[part] = {};
    const entered = node[part];
    if (entered === null || typeof entered !== "object") break;
    node = entered as ConfigValues;
  }
  node[parts.at(-1) ?? key] = value;
  return next;
}

import type { ConfigValues } from "../capability-types.ts";

function isObject(value: unknown): value is ConfigValues { return typeof value === "object" && value !== null; }

/** A copy of `object` with the dot path `key` set to `value` (objects on the way are created where missing). */
export function setPath(object: ConfigValues | undefined, key: string, value: unknown): ConfigValues {
  const parts = key.split(".");
  const next: ConfigValues = structuredClone(object ?? {});
  let node = next;
  for (const part of parts.slice(0, -1)) {
    const child = node[part];
    if (child === null || typeof child !== "object") node[part] = {};
    const entered = node[part];
    if (!isObject(entered)) break;
    node = entered;
  }
  node[parts.at(-1) ?? key] = value;
  return next;
}

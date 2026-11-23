import { parts } from "./parse-key-path.ts";
import { isObject } from "./is-config-object.ts";

export function setPath(object: Record<string, unknown>, key: string, value: unknown): void {
  const path = parts(key);
  let node = object;
  for (const part of path.slice(0, -1)) {
    if (!isObject(node[part])) node[part] = {};
    node = node[part] as Record<string, unknown>;
  }
  node[path.at(-1)!] = value;
}

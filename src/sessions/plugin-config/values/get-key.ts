import { parts } from "./parse-key-path.ts";
import { isObject } from "./is-config-object.ts";

export function getPath(object: unknown, key: string): unknown {
  let node = object;
  for (const part of parts(key)) {
    if (!isObject(node)) return undefined;
    node = node[part];
  }
  return node;
}

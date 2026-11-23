import { join } from "node:path";
import { read } from "./read-scope-file.mjs";
import { integer } from "./parse-scope-integer.mjs";

export function counter(scope, file, name) {
  const value = read(scope, file).match(new RegExp(`^${name}[ \\t]+(\\d+)$`, "mu"))?.[1];
  return integer(value, `${join(scope, file)} ${name}`);
}

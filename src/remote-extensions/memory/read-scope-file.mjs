import { readFileSync } from "node:fs";
import { join } from "node:path";

export function read(scope, file) {
  return readFileSync(join(scope, file), "utf8").trim();
}

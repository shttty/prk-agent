import { join } from "node:path";

export function selectSessionPaths(directory, names) {
  return names.filter((name) => name.endsWith(".jsonl"))
    .sort((a, b) => a < b ? -1 : a > b ? 1 : 0)
    .map((name) => join(directory, name));
}

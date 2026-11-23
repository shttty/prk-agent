import { readFileSync, readdirSync } from "node:fs";

/** Definitions sort by path; root assembly runs after every definition. */
export function readPythonSource(directory: URL): string {
  const files = readdirSync(directory, { recursive: true, encoding: "utf8" }).filter((name) => name.endsWith(".py"));
  files.sort((left, right) => Number(/^assemble[-_][^/]*\.py$/u.test(left)) - Number(/^assemble[-_][^/]*\.py$/u.test(right))
    || (left < right ? -1 : left > right ? 1 : 0));
  return files.map((name) => readFileSync(new URL(name, directory), "utf8")).join("\n\n");
}

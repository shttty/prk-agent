import { listBinaries } from "./list-binaries.ts";
import { WRAPPERS } from "./binary-wrappers.ts";

/** Session prompt line; only tools with a current manifest version are advertised. */
export function binPrompt(dir: string): string | undefined {
  const names = listBinaries(dir);
  if (names.length === 0) return undefined;
  const wrappers = names.flatMap((name) => Object.hasOwn(WRAPPERS, name) ? WRAPPERS[name]! : []);
  return `Gateway-distributed Linux CLIs: ${names.join(", ")}. tool_bin(name) returns its verified absolute path on this target after explicit instance environment deployment, e.g. bash(f"{tool_bin('${names[0]}')} --help").`
    + (wrappers.length ? ` Built-in wrappers: ${wrappers.join("; ")}.` : "");
}

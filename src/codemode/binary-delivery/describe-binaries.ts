import { listBinaries } from "./list-binaries.ts";

/** Session prompt line; only tools with a current manifest version are advertised. */
export function binPrompt(dir: string): string | undefined {
  const names = listBinaries(dir);
  return names.length === 0 ? undefined : `Gateway-distributed Linux CLIs: ${names.join(", ")}; tool_bin(name) resolves one, e.g. bash(f"{tool_bin('${names[0]}')} --help").`;
}

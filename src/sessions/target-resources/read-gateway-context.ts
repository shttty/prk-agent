import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Pi's context filename precedence, restricted to the SDK's global agent directory. */
export function gatewayContextFile(agentDir: string): Array<{ path: string; content: string }> {
  for (const name of ["AGENTS.override.md", "AGENTS.md", "AGENTS.MD", "CLAUDE.md", "CLAUDE.MD"]) {
    const path = join(agentDir, name);
    if (!statSync(path, { throwIfNoEntry: false })?.isFile()) continue;
    return [{ path, content: readFileSync(path, "utf8").replace(/^\uFEFF/u, "") }];
  }
  return [];
}

import { result } from "./format-result.ts";
import type { TerminalToolsContext } from "./terminal-tools-types.ts";

export function listTerminals(ctx: TerminalToolsContext) {
  return async function execute() { return result(await ctx.terminals().list()); };
}

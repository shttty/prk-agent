import { result } from "./format-result.ts";
import type { TerminalSet } from "../../../workspace/model-terminals/model-terminals-types.ts";
import type { TerminalToolsContext } from "./terminal-tools-types.ts";

export function configureTerminal(ctx: TerminalToolsContext) {
  return async function execute(_id: string, args: TerminalSet) { return result(await ctx.terminals().set(args)); };
}

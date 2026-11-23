import { result } from "./format-result.ts";
import type { TerminalToolsContext } from "./terminal-tools-types.ts";

export function closeTerminal(ctx: TerminalToolsContext) {
  return async function execute(_id: string, args: { name: string }) { await ctx.terminals().close(args.name); return result({ name: args.name, closed: true }); };
}

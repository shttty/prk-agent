import { result } from "./format-result.ts";
import type { TerminalRead } from "../../../workspace/model-terminals/model-terminals-types.ts";
import type { TerminalToolsContext } from "./terminal-tools-types.ts";

export function readOutput(ctx: TerminalToolsContext) {
  return async function execute(_id: string, args: TerminalRead, signal?: AbortSignal) { return result(await ctx.terminals().read(args, signal)); };
}

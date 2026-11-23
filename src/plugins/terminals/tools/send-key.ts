import { result } from "./format-result.ts";
import type { TerminalKey } from "../../../workspace/model-terminals/model-terminals-types.ts";
import type { TerminalToolsContext } from "./terminal-tools-types.ts";

export function sendKey(ctx: TerminalToolsContext) {
  return async function execute(_id: string, args: TerminalKey, signal?: AbortSignal) { return result(await ctx.terminals().key(args, signal)); };
}

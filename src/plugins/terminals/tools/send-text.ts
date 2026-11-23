import { result } from "./format-result.ts";
import type { TerminalSend } from "../../../workspace/model-terminals/model-terminals-types.ts";
import type { TerminalToolsContext } from "./terminal-tools-types.ts";

export function sendText(ctx: TerminalToolsContext) {
  return async function execute(_id: string, args: TerminalSend, signal?: AbortSignal) { return result(await ctx.terminals().send(args, signal)); };
}

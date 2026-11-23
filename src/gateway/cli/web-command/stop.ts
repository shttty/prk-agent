import type { WebCommandContext } from "../command-state.ts";

export function stop(ctx: WebCommandContext): void {
  void ctx.application.close().catch(() => { process.exitCode = 1; console.error("Web client shutdown failed."); });
}

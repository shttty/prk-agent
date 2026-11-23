import type { GatewayCommandContext } from "../command-state.ts";

export function stop(ctx: GatewayCommandContext): void {
  void ctx.endpoint?.close().catch(() => { process.exitCode = 1; console.error("Gateway owned shutdown failed."); });
}

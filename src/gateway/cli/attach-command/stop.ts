import type { AttachCommandContext } from "../command-state.ts";

export function stop(ctx: AttachCommandContext): void {
  ctx.client.disconnect();
}

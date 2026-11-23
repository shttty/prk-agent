import type { ClientContext } from "../client-state.ts";

export function readConnectionStatus(ctx: ClientContext): boolean {
  return ctx.lost;
}

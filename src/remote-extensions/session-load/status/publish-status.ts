import type { LoadContext } from "../load-types.ts";

export function publish(ctx: LoadContext): void {
  ctx.input.onStatus?.(ctx.statuses.map((status) => ({ ...status })));
}

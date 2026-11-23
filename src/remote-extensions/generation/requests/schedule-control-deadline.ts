import type { RequestContext } from "../generation-types.ts";
import { fail } from "../lifecycle/fail.ts";

export function scheduleControlDeadline(ctx: RequestContext): NodeJS.Timeout | undefined {
  return ctx.method === "execute" || ctx.method === "event" || ctx.method === "command" ? undefined
    : setTimeout(() => fail(ctx.generation, new Error(`Remote extension ${ctx.method} timed out; outcome is unknown, request was not replayed.`)), ctx.generation.options.requestTimeoutMs ?? 30_000);
}

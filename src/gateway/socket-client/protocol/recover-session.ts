import type { Method, RecoveryMode } from "../../wire/wire-types.ts";

export function recoverSession(ctx: { request(method: Method, params: Record<string, unknown>): Promise<unknown> }, sessionId: string, mode: RecoveryMode): Promise<unknown> {
  return ctx.request("recoverSession", { sessionId, mode });
}

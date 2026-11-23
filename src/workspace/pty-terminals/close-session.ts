import type { PtyContext } from "./terminal-state.ts";
import { closeTerminal } from "./close-terminal.ts";

export function closeSession(ctx: PtyContext, sessionId: string): Promise<void> {
  const existing = ctx.closingSessions.get(sessionId);
  if (existing) return existing;
  const closing = (async () => {
    const names = [...(ctx.sessions.get(sessionId)?.keys() ?? [])];
    const results = await Promise.allSettled(names.map((name) => closeTerminal(ctx, sessionId, name)));
    const errors = results.flatMap((result) => result.status === "rejected" ? [result.reason] : []);
    if (errors.length) throw new AggregateError(errors, "Session terminal cleanup could not be confirmed.");
  })();
  ctx.closingSessions.set(sessionId, closing);
  void closing.finally(() => ctx.closingSessions.delete(sessionId)).catch(() => {});
  return closing;
}

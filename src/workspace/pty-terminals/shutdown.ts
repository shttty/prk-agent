import type { PtyContext } from "./terminal-state.ts";
import { closeSession } from "./close-session.ts";

export async function shutdown(ctx: PtyContext): Promise<void> {
  ctx.stopped = true;
  const sessions = new Set([...ctx.sessions.keys(), ...ctx.closingSessions.keys()]);
  const results = await Promise.allSettled([...sessions].map((id) => closeSession(ctx, id)));
  const errors = results.flatMap((result) => result.status === "rejected" ? [result.reason] : []);
  if (errors.length) throw new AggregateError(errors, "Terminal shutdown cleanup could not be confirmed.");
}

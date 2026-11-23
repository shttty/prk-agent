import type { RuntimeLinkContext } from "../link-state.ts";

export function exit(ctx: RuntimeLinkContext, reason: string): void {
  if (ctx.exited !== undefined) return;
  ctx.exited = reason;
  clearTimeout(ctx.startTimer);
  const error = Object.assign(new Error(reason), { code: "unknown" });
  ctx.handshake.reject(error);
  for (const reply of ctx.replies.values()) reply.reject(error);
  ctx.window.retire();
  ctx.onExit(reason);
}

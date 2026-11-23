import type { HostContext } from "../../host/host-state.ts";

export async function changeSessionRuntime<T>(ctx: HostContext, sessionId: string, action: () => Promise<T>): Promise<T> {
  while (ctx.lifecycle.transitions.has(sessionId)) await ctx.lifecycle.transitions.get(sessionId);
  const result = ctx.methods.runtimeChange(action);
  const transition = result.then(() => { });
  void transition.catch(() => { });
  ctx.lifecycle.transitions.set(sessionId, transition);
  try { return await result; } finally { ctx.lifecycle.transitions.delete(sessionId); }
 }

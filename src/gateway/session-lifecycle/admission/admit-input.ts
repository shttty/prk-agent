import type { HostContext } from "../../host/host-state.ts";

export async function admitInput<T>(ctx: HostContext, sessionId: string, action: () => Promise<T>, wakeSleeping = true): Promise<T> {
  await ctx.lifecycle.transitions.get(sessionId);
  return ctx.methods.runtimeChange(async () => {
   if (wakeSleeping) await ctx.methods.wake(sessionId);
   const binding = ctx.sessionHosts.hostBindings.get(sessionId);
   if (binding) binding.idleSince = undefined;
   try { return await action(); }
   finally { if (binding) binding.idleSince = undefined; }
  });
 }

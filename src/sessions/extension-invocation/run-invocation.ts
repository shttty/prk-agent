import type { InvocationContext } from "./invocation-types.ts";

export async function run<T>(ctx: InvocationContext, action: () => Promise<T>): Promise<T> {
  if (ctx.idle.signal.aborted) ctx.idle = new AbortController();
  const controller = new AbortController();
  const owner: { signal?: AbortSignal } = { signal: controller.signal };
  ctx.active.add(controller);
  try { return await ctx.invocation.run(owner, action); }
  finally { owner.signal = undefined; ctx.active.delete(controller); }
}

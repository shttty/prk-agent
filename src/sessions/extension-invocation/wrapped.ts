import type { Extension, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { InvocationContext, Handler } from "./invocation-types.ts";

export function wrapped(ctx: InvocationContext, extension: Extension, handler: Handler, args: unknown[]): Promise<unknown> {
  const context = args[1] as ExtensionContext | undefined;
  const event = args[0] as { readonly type?: string; readonly signal?: AbortSignal } | undefined;
  // Shutdown is a new control call, not work left over from the cancelled turn.
  const shutdown = event?.type === "session_shutdown" ? new AbortController() : undefined;
  const invocation = ctx.invocation.getStore();
  const signals = (shutdown
    ? [shutdown.signal, ctx.signal?.aborted ? undefined : ctx.signal, context?.signal, event?.signal]
    : invocation?.cellSignal ? [ctx.lifetime.signal, ctx.signal, invocation.cellSignal]
    : [ctx.lifetime.signal, ctx.signal, ctx.idle.signal, invocation?.signal, context?.signal, event?.signal])
    .filter((value): value is AbortSignal => value !== undefined);
  const abort = AbortSignal.any(signals);
  // Shutdown still starts cooperative cleanup, even when its owner is already closing.
  if (invocation?.cellSignal?.aborted && !shutdown) return Promise.resolve(undefined);
  if (event?.type !== "session_shutdown") abort.throwIfAborted();
  if (context) {
    const descriptors = Object.getOwnPropertyDescriptors(context);
    descriptors.signal = { value: abort, enumerable: true };
    if (ctx.bindUI) descriptors.ui = { value: ctx.bindUI(extension, context), enumerable: true };
    args[1] = Object.defineProperties({}, descriptors);
  }
  if (shutdown) ctx.shutdownControllers.add(shutdown);
  let result: Promise<unknown>;
  try { result = handler(...args); }
  catch (error) { if (shutdown) ctx.shutdownControllers.delete(shutdown); throw error; }
  // Keep synchronous SDK admission/cleanup synchronous; only pending work needs a race.
  if (!result || typeof result.then !== "function") {
    if (shutdown) ctx.shutdownControllers.delete(shutdown);
    return result;
  }
  const cancelled = Promise.withResolvers<unknown>();
  let abortTask: NodeJS.Immediate | undefined;
  // Let the original abort listeners and their promise continuations settle first.
  const onAbort = (): void => {
    abortTask ??= setImmediate(() => {
      if (invocation?.cellSignal?.aborted && !shutdown) cancelled.resolve(undefined);
      else cancelled.reject(abort.reason);
    });
  };
  if (abort.aborted) onAbort();
  else abort.addEventListener("abort", onAbort, { once: true });
  return Promise.race([result, cancelled.promise]).finally(() => {
    if (shutdown) ctx.shutdownControllers.delete(shutdown);
    abort.removeEventListener("abort", onAbort);
    clearImmediate(abortTask);
  });
}

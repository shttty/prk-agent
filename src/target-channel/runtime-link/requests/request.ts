import { errorOf } from "../../connection-error/normalize-error.ts";
import type { Reply, RuntimeLinkContext } from "../link-state.ts";
import { exit } from "../connection/end-link.ts";

export function request(ctx: RuntimeLinkContext, mod: string, op: string, args: Record<string, unknown> = {}, signal?: AbortSignal): Promise<Reply> {
  if (signal?.aborted) return Promise.reject(errorOf(signal.reason));
  if (ctx.exited !== undefined) return Promise.reject(Object.assign(new Error(ctx.exited), { code: "unknown" }));
  if (ctx.stage !== "run") return Promise.reject(new Error("Target channel is not ready."));
  const id = ++ctx.nextId;
  let frame: string;
  try {
    frame = `${JSON.stringify({ ...args, id, mod, op })}\n`;
    ctx.window.reserve(id, Buffer.byteLength(frame));
  } catch (error) { return Promise.reject(error); }
  if (signal?.aborted) {
    ctx.window.confirm(id); // No bytes were submitted; this is not a target consumption acknowledgment.
    return Promise.reject(errorOf(signal.reason));
  }
  const result = Promise.withResolvers<Reply>();
  const settle = (error?: Error, reply?: Reply): void => {
    if (!ctx.replies.delete(id)) return;
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
    if (error) result.reject(error); else result.resolve(reply!);
  };
  const abort = (): void => settle(errorOf(signal!.reason));
  const timer = setTimeout(() => settle(Object.assign(new Error(`Target channel ${mod}.${op} request timed out.`), { code: "unknown" })), ctx.timeoutMs);
  ctx.replies.set(id, { reject: (error) => settle(error), resolve: (reply) => settle(undefined, reply) });
  signal?.addEventListener("abort", abort, { once: true });
  try { ctx.transport.write(frame); }
  catch (error) { exit(ctx, errorOf(error).message); }
  return result.promise;
}

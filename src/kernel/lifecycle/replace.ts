import type { KernelCell, KernelContext, KernelReplacement } from "../kernel-state.ts";
import { stop } from "../process/stop.ts";
import { ensure } from "./ensure.ts";

export async function replace(ctx: KernelContext, resetCell?: KernelCell) {
  const replacement = Promise.withResolvers<KernelReplacement>();
  ctx.replacing = replacement.promise;
  void replaceGeneration().then(replacement.resolve, replacement.reject);
  try { return await replacement.promise; }
  finally { ctx.replacing = undefined; }

  async function replaceGeneration() {
    const starting = ctx.starting;
    const unsubmitted = [...ctx.cells.values()].filter((cell) => cell !== resetCell && cell.requestId === undefined);
    const stopped = ctx.process && stop(ctx, ctx.process, { cause: resetCell ? "reset" : "replace" });
    ctx.startupCancellation?.abort(new Error("Kernel startup retired by reset."));
    const retirement = await stopped;
    await Promise.allSettled([starting, ...unsubmitted.map((cell) => cell.released.promise)]);
    if (ctx.closed || ctx.handoff || ctx.preparingHandoff) throw new Error("Kernel closed or changed owner during replacement.");
    ctx.process = undefined;
    ctx.namespaceAfterCompaction = false;
    return { process: await ensure(ctx), retirement };
  }
}

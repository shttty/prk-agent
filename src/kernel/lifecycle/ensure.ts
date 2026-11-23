import type { KernelContext, KernelProcess } from "../kernel-state.ts";
import { start } from "../process/start.ts";
import { runMaintenance } from "./run-maintenance.ts";
import { kernelPrelude } from "../../codemode/kernel-prelude/build-prelude.ts";
import { publish } from "../telemetry/publish.ts";
import { stop } from "../process/stop.ts";
import { waitBeforeAbort } from "../process/wait-before-abort.ts";
import { readExecutionCapacity } from "../process/read-execution-capacity.ts";

export async function ensure(ctx: KernelContext, configuredMaxActiveCells?: number): Promise<KernelProcess> {
  if (ctx.closed) throw new Error("Kernel is closed.");
  if (ctx.handoff || ctx.preparingHandoff || ctx.changingLanguage) throw new Error("Kernel owner or language is changing.");
  if (ctx.starting) return ctx.starting;
  if (ctx.process && !ctx.process.retired) return ctx.process;
  const previous = ctx.process;
  const maxActiveCells = ctx.startupMaxActiveCells = readExecutionCapacity(ctx, configuredMaxActiveCells);
  const starting = Promise.withResolvers<KernelProcess>();
  const cancellation = ctx.startupCancellation = new AbortController();
  ctx.starting = starting.promise;
  void initialize().then(starting.resolve, starting.reject);
  try { return await starting.promise; }
  finally {
    ctx.starting = undefined;
    ctx.startupMaxActiveCells = undefined;
    ctx.startupCancellation = undefined;
  }

  async function initialize() {
    if (previous) await previous.stopping;
    cancellation.signal.throwIfAborted();
    if (ctx.closed || ctx.handoff || ctx.preparingHandoff) throw new Error("Kernel closed or changed owner during startup.");
    if (previous) ctx.namespaceAfterCompaction = false;
    ctx.process = undefined;
    await start(ctx, cancellation.signal, maxActiveCells);
    const process = ctx.process!;
    try {
      if (process.language === "python") {
        const scoped = process.scoped;
        const source = await waitBeforeAbort(ctx.hooks.prelude ? ctx.hooks.prelude(scoped) : kernelPrelude({
          kernel: { memoryMax: ctx.configuration.memoryMax, memorySwapMax: ctx.configuration.memorySwapMax, telemetryIntervalMs: ctx.options.telemetryIntervalMs, scoped },
          library: ctx.hooks.libraryEntries?.() ?? [],
        }), AbortSignal.any([process.retirement.signal, AbortSignal.timeout(ctx.options.startTimeoutMs)]));
        const { outcome, output } = await runMaintenance(ctx, process, { kind: "initialize", source });
        if (outcome !== "ok") throw new Error(`Kernel initialization failed: ${output}`);
      }
      if (ctx.closed || process.retired) throw new Error("Kernel closed during initialization.");
      publish(ctx, { state: "idle" });
      return process;
    } catch (error) {
      await stop(ctx, process, { failure: error });
      throw error;
    }
  }
}

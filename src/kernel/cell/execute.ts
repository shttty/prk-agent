import type { Static } from "typebox";
import { Value } from "typebox/value";
import type { ExtensionToolContext } from "@earendil-works/pi-coding-agent";
import type { KernelContext, KernelCell, KernelProcess } from "../kernel-state.ts";
import { pythonParameters } from "../declaration/kernel-tool-schema.ts";
import { ensure } from "../lifecycle/ensure.ts";
import { replace } from "../lifecycle/replace.ts";
import { run } from "./run.ts";
import { createCell } from "./create-cell.ts";
import { DEFAULT_KERNEL_EXECUTION_POLICY, DEFAULT_SYNC_EXECUTION_TIMEOUT_MS } from "../kernel-options.ts";
import { DEFAULT_TERMINAL_OPTIONS } from "../../config/terminal/terminal-options.ts";
import { milliseconds } from "../../workspace/model-terminals/timing/parse-duration.ts";
import { runningCellResult } from "../output/format-running-cell.ts";
import { normalizeCellImages } from "../output/normalize-cell-images.ts";
import { releaseCellImages } from "../output/capture-image.ts";
import { result } from "../output/format-cell-result.ts";
import type { KernelCellResult, KernelExecutionOwner, KernelToolResult, PythonOutcome } from "../kernel-types.ts";
import { publish } from "../telemetry/publish.ts";
import { publishFinished } from "./publish-finished.ts";
import { recordCallback } from "../callback/record-callback.ts";
import { interrupt } from "../process/interrupt.ts";
import { readExecutionCapacity } from "../process/read-execution-capacity.ts";
import { taskName } from "../../../shared/background-task-name.js";

export async function execute(ctx: KernelContext, foregroundOnly: boolean, owner: KernelExecutionOwner | undefined, toolCallId: string,
  args: Static<typeof pythonParameters>, signal?: AbortSignal, onUpdate?: KernelCell["onUpdate"], sdk?: ExtensionToolContext): Promise<KernelToolResult> {
  signal?.throwIfAborted();
  if (!Value.Check(pythonParameters, args)) {
    throw Object.assign(new Error("Invalid kernel_code arguments."), { code: "INVALID_REQUEST", submitted: false });
  }
  const { mode, inputs, outputs } = args;
  if (ctx.configuration.bun && (mode !== undefined || inputs !== undefined || outputs !== undefined)) {
    throw Object.assign(new Error("Bun cells do not accept Python execution modes or isolated inputs/outputs."), { code: "INVALID_REQUEST", submitted: false });
  }
  if (inputs !== undefined || outputs !== undefined) {
    if (args.reset && args.code === "") {
      throw Object.assign(new Error("kernel_code inputs and outputs are not allowed on a restart-only request."), { code: "INVALID_REQUEST", submitted: false });
    }
    if (mode !== undefined && mode !== "isolated") {
      throw Object.assign(new Error("kernel_code inputs and outputs require isolated execution."), { code: "INVALID_REQUEST", submitted: false });
    }
  }
  const policy = ctx.hooks.executionPolicy?.() ?? DEFAULT_KERNEL_EXECUTION_POLICY;
  const asynchronous = !foregroundOnly && policy.asyncExecution;
  const outputOptions = ctx.hooks.outputOptions ?? DEFAULT_TERMINAL_OPTIONS;
  const yieldMs = asynchronous ? milliseconds(args.yield_s, outputOptions.yieldMs, outputOptions.maxYieldMs, "yield_s") : undefined;
  const timing = { timeoutMs: ctx.options.executionTimeoutMs || (asynchronous ? 0 : DEFAULT_SYNC_EXECUTION_TIMEOUT_MS),
    reminderLadderMs: asynchronous ? policy.reminderLadderMs : [] };
  const { defaultCellMode } = policy;
  if (ctx.handoff || ctx.preparingHandoff || ctx.changingLanguage || ctx.replacing || (ctx.maintenance && !ctx.starting)
    || (!args.reset && ctx.cells.size >= readExecutionCapacity(ctx, policy.maxActiveCells))) {
    throw Object.assign(new Error("Kernel is busy."), { code: "BUSY", transient: true, submitted: false });
  }
  if (ctx.closed) throw Object.assign(new Error("Kernel is closed."), { submitted: false });
  const command = { kind: "execute", code: args.code, title: args.title ?? (ctx.configuration.bun ? "Bun cell" : "Python cell"),
    ...(ctx.configuration.bun ? {} : { defaultCellMode,
      ...(mode === undefined ? {} : { mode }),
      ...(inputs === undefined ? {} : { inputs }),
      ...(outputs === undefined ? {} : { outputs }) }) };
  const cell = createCell(ctx, timing);
  cell.toolCallId = toolCallId;
  cell.taskName = taskName({ kind: "kernel", title: args.title, code: args.code });
  cell.runCallback = owner?.runCallback;
  cell.sdk = sdk;
  cell.onUpdate = onUpdate;
  ctx.cells.set(cell.id, cell);
  let imageOwner: KernelProcess | undefined;
  let cancelYield: (() => void) | undefined;
  try {
    if (args.reset) {
      const replacement = await waitForStartup(replace(ctx, cell), signal);
      imageOwner = replacement.process;
      cell.reset = replacement.retirement;
    } else imageOwner = await waitForStartup(ensure(ctx, policy.maxActiveCells), signal);
    const process = imageOwner;
    signal?.throwIfAborted();
    if (ctx.handoff) throw Object.assign(new Error("Kernel owner is changing."), { code: "BUSY", transient: true });
    const generation = process.generation;
    if (args.reset && args.code === "") {
      if (ctx.closed || process.retired) throw new Error("Kernel closed before reset completed.");
      const value = await result({ target: ctx.configuration.target, hooks: ctx.hooks, namespaceAfterCompaction: false },
        signal, "Kernel restarted.", "ok", false, generation, undefined, undefined, [], false, undefined, { reset: cell.reset });
      value.details.language = process.language;
      return value;
    }
    const yielded = yieldMs === undefined ? undefined : Promise.withResolvers<void>();
    if (yielded && yieldMs !== undefined) {
      cell.startForegroundWait = (admittedAt) => {
        cell.foregroundDue = admittedAt + yieldMs;
        if (yieldMs === 0) yielded.resolve();
        else cancelYield = ctx.clock.schedule(yielded.resolve, Math.max(0, Math.ceil(cell.foregroundDue - ctx.clock.now())));
      };
    }
    const done = run(ctx, process, cell, command, signal);
    const settled = cell.result = settle();
    if (!yielded) return await settled;
    const winner = await Promise.race([cell.done.then(() => "done" as const), yielded.promise]);
    cancelYield?.();
    cell.foregroundDue = undefined;
    if (winner === "done" || cell.outcome !== undefined || process.retired || ctx.handoff || ctx.closed) return await settled;
    const identity = { cellId: cell.id, kernelId: generation, toolCallId, startedAt: cell.startedAt, language: process.language };
    try { owner?.beforeYield(identity); }
    catch (error) {
      const failure = new Error("Could not save the running kernel cell to the session; interruption requested.", { cause: error });
      void interrupt(ctx, cell, failure.message).catch(() => {});
      await settled.catch(() => {});
      throw failure;
    }
    cell.yielded = true;
    cell.detachSignal?.();
    cell.onUpdate = undefined;
    clearTimeout(cell.progressTimer);
    if (cell.pendingCallback) recordCallback(cell, cell.pendingCallback);
    publish(ctx, {});
    void settled.catch((error) => console.error("[kernel] Cell settlement failed:", error));
    return runningCellResult(ctx, cell, generation, toolCallId, outputOptions);

    async function settle(): Promise<KernelCellResult> {
      try {
        const value = cell.frozen = await freeze(await done);
        if (cell.yielded) publishFinished(ctx, cell, value);
        return value;
      } finally { release(); }
    }

    async function freeze(outcome: PythonOutcome): Promise<KernelCellResult> {
      if (cell.rejection && !cell.yielded) throw cell.rejection;
      const normalized = await normalizeCellImages({ images: cell.images, omittedImages: cell.omittedImages }, cell.yielded ? undefined : sdk?.model);
      const view = { target: ctx.configuration.target, hooks: ctx.hooks, cellDetails: cell.details, namespaceAfterCompaction: ctx.namespaceAfterCompaction };
      const text = cell.output.text + cell.output.tail + normalized.notes.join("\n");
      const value = result(view, cell.yielded ? (cell.interruption ? cell.callbacks.signal : undefined) : signal,
        text || (outcome === "ok" ? "Execution completed." : "Kernel execution did not complete."), outcome,
        cell.output.truncated, generation, cell.memory,
        cell.output.truncated ? { at: cell.output.text.length, chars: cell.output.omittedChars } : undefined,
        normalized.images, cell.yielded, cell.retirement, { reset: cell.reset, suggestedMode: cell.suggestedMode });
      value.details.language = process.language;
      if (cell.mode !== undefined) value.details.mode = cell.mode;
      ctx.namespaceAfterCompaction = view.namespaceAfterCompaction;
      return value;
    }
  } catch (error) {
    if (cell.requestId !== undefined) throw error;
    throw Object.assign(new Error(error instanceof Error ? error.message : String(error), { cause: error }), error, { submitted: false });
  } finally {
    if (!cell.result) {
      cancelYield?.();
      release();
    }
  }

  function release() {
    if (imageOwner) releaseCellImages(imageOwner, cell);
    ctx.cells.delete(cell.id);
    cell.released.resolve();
    if (ctx.closed || !ctx.process || ctx.process.retired || ctx.snapshot.state !== "busy" || ctx.maintenance) {
      if (cell.yielded) publish(ctx, {});
    } else if (!ctx.cells.size) publish(ctx, { state: "idle", lastOutcome: cell.rejection ? undefined : cell.outcome });
    else if (cell.yielded) publish(ctx, {});
  }
}

async function waitForStartup<T>(starting: Promise<T>, signal?: AbortSignal) {
  if (!signal) return starting;
  const aborted = Promise.withResolvers<never>();
  const abort = () => aborted.reject(signal.reason);
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  try { return await Promise.race([starting, aborted.promise]); }
  finally { signal.removeEventListener("abort", abort); }
}

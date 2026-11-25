import { Value } from "typebox/value";
import type { KernelContext, KernelProcess } from "../kernel-state.ts";
import { runnerEvent, type RunnerEvent } from "./event-schema.ts";
import { addOutput } from "../output/capture-output.ts";
import { kernelTelemetry } from "../../codemode/kernel-protocol/decode-telemetry.ts";
import { KERNEL_TOOL_CATALOG_MIME } from "../../codemode/module-catalog/catalog-protocol.ts";
import { CODE_MIMES } from "../../codemode/kernel-protocol/kernel-protocol-schema.ts";
import { parseKernelToolCatalog } from "../../codemode/module-catalog/parse-catalog.ts";
import { publish } from "../telemetry/publish.ts";
import { captureDiagnostic } from "../telemetry/capture-diagnostic.ts";
import { captureImage } from "../output/capture-image.ts";
import { receiveCallbackChunk } from "../callback/receive-callback-chunk.ts";
import { stop } from "../process/stop.ts";
import { publishProgress } from "../telemetry/publish-progress.ts";
import { ownsFrames } from "../cell/owns-frames.ts";
import { setBudget } from "../cell/set-budget.ts";

export function receive(ctx: KernelContext, process: KernelProcess, bytes: Uint8Array): void {
  if (process.retired || ctx.process !== process) return;
  try {
    process.buffer += process.decoder.write(Buffer.from(bytes));
    let newline: number;
    while (!process.retired && (newline = process.buffer.indexOf("\n")) >= 0) {
      const line = process.buffer.slice(0, newline);
      process.buffer = process.buffer.slice(newline + 1);
      if (Buffer.byteLength(line) + 1 > ctx.configuration.processWindow.maxFrameBytes) throw new Error("Kernel frame exceeds budget.");
      const message: unknown = JSON.parse(line);
      if (!Value.Check(runnerEvent, message)) throw new Error("Invalid kernel event.");
      if (message.generation !== process.generation) continue;
      dispatchEvent(ctx, process, message);
    }
    if (Buffer.byteLength(process.buffer) > ctx.configuration.processWindow.maxFrameBytes) throw new Error("Unterminated kernel frame exceeds budget.");
  } catch (error) {
    void stop(ctx, process, { failure: error }).catch((cleanup) => { console.error("[kernel] Invalid generation cleanup unconfirmed:", cleanup); });
  }
}

function dispatchEvent(ctx: KernelContext, process: KernelProcess, message: RunnerEvent): void {
  if (message.kind === "ready") {
    if (message.language !== process.language) throw new Error(`Expected a ${process.language} kernel ready event.`);
    if (process.pid !== undefined) return;
    process.pid = message.pid;
    process.forkserverPid = message.forkserverPid;
    process.pgid = message.pgid;
    process.scoped = message.scoped;
    process.ready.resolve();
    return;
  }
  if (message.kind === "fatal") throw new Error(message.error);
  if (message.kind === "diagnostic") {
    captureDiagnostic(ctx, message.stream, message.text);
    return;
  }
  if (message.kind === "display" && message.cellId === null) {
    for (const event of kernelTelemetry(message.data, message.metadata)) {
      if (event.kind !== "memory" || event.cellEnd) continue;
      ctx.hooks.onTelemetry?.(event);
      publish(ctx, { memory: event.value });
    }
    return;
  }

  const cell = message.cellId === null ? undefined
    : ctx.maintenance?.id === message.cellId ? ctx.maintenance : ctx.cells.get(message.cellId);
  if (message.kind === "cell_admitted") {
    if ((message.mode === undefined) !== (process.language === "bun")) throw new Error("Invalid admission mode for kernel language.");
    if (!cell || cell === ctx.maintenance || !ownsFrames(ctx, process, cell) || cell.admitted) return;
    const pending = process.pendingRequests.get(message.re);
    if (cell.requestId !== message.re || !pending || pending.control || pending.cellId !== cell.id) return;
    // Admission reports the runner's actual selection; only a terminal frame returns execute credit.
    cell.admitted = true;
    cell.mode = message.mode;
    cell.interruption?.reconsiderEscalation?.();
    if (process.retired) return;
    const admittedAt = ctx.clock.now();
    // Start before processing the next frame: an ask or terminal in this batch can stop the clock.
    cell.startForegroundWait?.(admittedAt);
    cell.startForegroundWait = undefined;
    if (cell.pendingCallback?.name !== "ask") setBudget(ctx, cell, false, admittedAt);
    return;
  }
  if ("re" in message) {
    const pending = process.pendingRequests.get(message.re);
    if (!pending || pending.cellId !== message.cellId || pending.control !== (message.kind === "ack")) return;
    // Control credit belongs to the pending request, even if its cell has already settled.
    process.pendingRequests.delete(message.re);
    process.window.confirm(message.re);
    if (message.kind === "ack" || !cell || cell.requestId !== message.re || !ownsFrames(ctx, process, cell)) return;
    if (message.kind === "cell_end") cell.resolve(message.outcome);
    else {
      const reason = message.reason ? `: ${message.reason}` : "";
      const error = cell.rejection = Object.assign(new Error(`Runner rejected command: ${message.code}${reason}`), {
        code: message.code, ...(message.code === "BUSY" ? { transient: true } : {}), submitted: false,
      });
      addOutput(cell.output, `${error.message}\n`, ctx.options);
      cell.resolve("error");
    }
    return;
  }

  if (!cell || !ownsFrames(ctx, process, cell)) return;
  switch (message.kind) {
    case "cell_state": {
      const { state, blockedAt, observedAt } = message;
      cell.runnerState = { state, blockedAt, observedAt };
      if (state === "stopping" && process.language === "python" && (cell.mode === "thread" || cell.mode === "async") && cell.interruption) {
        const timer = blockedAt?.find(({ step, status }) => step === "timer" && status === "bounded");
        if (timer?.remainingMs !== undefined) cell.interruption.observeTimerWait(timer.remainingMs);
      }
      if (cell.yielded) publish(ctx, {});
      break;
    }
    case "callback_chunk": receiveCallbackChunk(ctx, process, cell, message); break;
    case "stream": addOutput(cell.output, message.text, ctx.options); break;
    case "error": addOutput(cell.output, `${message.name}: ${message.message}\n${message.traceback.join("")}\n`, ctx.options); break;
    case "image_omitted": cell.omittedImages++; break;
    case "image": captureImage(ctx, process, cell, message); break;
    case "display": {
      for (const event of kernelTelemetry(message.data, message.metadata)) {
        ctx.hooks.onTelemetry?.(event);
        if (event.kind === "namespace") { cell.details.namespace = event.value; publish(ctx, { namespace: event.value }); }
        if (event.kind === "memory") { publish(ctx, { memory: event.value }); if (event.cellEnd) cell.memory = event.value; }
        if (event.kind === "trace") cell.details.traces.push(event.value);
        if (event.kind === "phase") cell.details.phases.push(event.value);
      }
      const catalog = message.data[KERNEL_TOOL_CATALOG_MIME];
      if (catalog !== undefined) {
        const helpers = parseKernelToolCatalog(catalog);
        ctx.helperNames = helpers.filter((helper) => helper.available !== false && !helper.moduleOnly).map(({ name }) => name);
        ctx.hooks.onToolCatalog?.(helpers);
      }
      const progress = message.data[CODE_MIMES.progress];
      if (progress && typeof progress === "object" && "text" in progress && typeof progress.text === "string"
        && cell.progressCount < ctx.options.maxProgressUpdates) {
        cell.progressText = (cell.progressText + progress.text).slice(-ctx.options.progressSuffixChars);
        publishProgress(ctx, cell);
      }
      break;
    }
  }
}

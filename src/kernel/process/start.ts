import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { StringDecoder } from "node:string_decoder";
import { openProcess } from "@earendil-works/pi-env";
import type { KernelContext, KernelProcess } from "../kernel-state.ts";
import { DEFAULT_KERNEL_EXECUTION_POLICY } from "../kernel-options.ts";
import { createKernelWindow } from "../protocol/assemble-kernel-window.ts";
import { sizeCallbackChunk } from "../protocol/size-callback-chunk.ts";
import { buildForkserver } from "../forkserver/build-forkserver.ts";
import { readPythonSource } from "../../target-channel/deployment-source/read-python-source.ts";
import { reserveStart } from "../../target-channel/process-transport/reserve-start.ts";
import { receive } from "../protocol/receive.ts";
import { captureDiagnostic } from "../telemetry/capture-diagnostic.ts";
import { publish } from "../telemetry/publish.ts";
import { stop } from "./stop.ts";
import { waitBeforeAbort } from "./wait-before-abort.ts";
import { resolveBun } from "./resolve-bun.ts";
import { readExecutionCapacity } from "./read-execution-capacity.ts";
import { bunPackageRoot } from "./bun-package-root.ts";

const unscopedMarker = "PRK kernel unscoped:";

export async function start(ctx: KernelContext, cancellation?: AbortSignal, maxActiveCells = readExecutionCapacity(ctx)): Promise<void> {
  const bun = ctx.configuration.bun;
  const forkserverPreload = bun ? [] : [...(ctx.hooks.executionPolicy?.() ?? DEFAULT_KERNEL_EXECUTION_POLICY).forkserverPreload];
  const limits = ctx.configuration.processWindow;
  const callbackChunkBytes = sizeCallbackChunk(ctx.options.chunkBytes, limits.maxFrameBytes);
  const acquiring = ctx.configuration.acquire();
  let lease: KernelProcess["lease"];
  const deadline = AbortSignal.timeout(ctx.options.startTimeoutMs);
  try { lease = await waitBeforeAbort(acquiring, cancellation ? AbortSignal.any([deadline, cancellation]) : deadline); }
  catch (error) {
    void acquiring.then((late) => releaseUnused(late), () => {});
    throw error;
  }
  if (ctx.closed || ctx.handoff || ctx.preparingHandoff || cancellation?.aborted) {
    await releaseUnused(lease);
    cancellation?.throwIfAborted();
    throw new Error("Kernel closed or changed owner during startup.");
  }
  const generation = `${lease.generation}/${randomUUID()}`;
  let window: KernelProcess["window"];
  try {
    window = createKernelWindow(limits, generation, callbackChunkBytes);
  } catch (error) {
    await releaseUnused(lease);
    throw error;
  }
  const process: KernelProcess = {
    generation, lease, window, callbackChunkBytes, maxActiveCells,
    language: bun ? "bun" : "python",
    scope: `prk-kernel-${randomUUID()}.scope`, scoped: ctx.configuration.scoped,
    decoder: new StringDecoder("utf8"), buffer: "", imageBytes: 0, requestId: 0,
    pendingRequests: new Map(),
    ready: Promise.withResolvers<void>(), retirement: new AbortController(), retired: false, detach: () => {},
  };
  const stderrDecoder = new StringDecoder("utf8");
  let scopeMarkerTail = "";
  process.ready.promise.catch(() => {});
  ctx.process = process;
  const lost = () => fail(lease.signal.reason);
  lease.signal.addEventListener("abort", lost, { once: true });
  process.detach = () => lease.signal.removeEventListener("abort", lost);
  const timer = setTimeout(() => fail(new Error("Kernel startup deadline exceeded.")), ctx.options.startTimeoutMs);
  try {
    lease.signal.throwIfAborted();
    publish(ctx, { state: "starting", kernelId: generation, connectionStatus: "connecting", memory: undefined, namespace: undefined, diagnostics: undefined });
    if (ctx.closed || process.retired) throw new Error("Kernel closed during startup.");
    const bootstrap = readFileSync(new URL("./bootstrap.py", import.meta.url), "utf8");
    const executable = bun ? await resolveBun(bun, process.retirement.signal) : undefined;
    // Only the fixed Python bootstrap is part of the open request, not the Bun runner.
    const entry = executable ? `bun_launcher = ${JSON.stringify(readFileSync(new URL("./launch-bun.py", import.meta.url), "utf8"))}\n${bootstrap}` : bootstrap;
    const argv = [ctx.configuration.python, "-u", "-c", entry, String(limits.maxFrameBytes)];
    if (executable) argv.push("bun");
    const env = bun ? ctx.hooks.environment : { ...ctx.hooks.environment, MPLBACKEND: "Agg" };
    if (process.retired) throw new Error("Kernel startup retired.");
    const confirm = reserveStart(lease.connection, ctx.configuration.cwd, argv, limits);
    const opening = process.opening = openProcess(lease.connection, {
      cwd: ctx.configuration.cwd, argv, env,
      onStdout: (bytes) => receive(ctx, process, bytes),
      onStderr: (bytes) => {
        if (ctx.process !== process) return;
        const text = stderrDecoder.write(bytes);
        if (process.scoped && process.pid === undefined) {
          // Only keep enough physical stderr context to recognize a split bootstrap marker.
          if (text.includes(unscopedMarker) || (scopeMarkerTail + text.slice(0, unscopedMarker.length - 1)).includes(unscopedMarker)) {
            process.scoped = false;
          } else {
            const tail = 1 - unscopedMarker.length;
            scopeMarkerTail = (scopeMarkerTail + text.slice(tail)).slice(tail);
          }
        }
        if (!process.retired) captureDiagnostic(ctx, "stderr", text);
      },
    }).finally(confirm).then((handle) => {
      process.process = handle;
      process.cancelProcess = () => {
        process.cancelProcess = undefined;
        handle.close();
      };
      void handle.exited.then((code) => fail(new Error(`Kernel exited (${code}).`)), fail);
      if (process.retired || ctx.closed || ctx.handoff) {
        process.cancelProcess();
        throw new Error("Kernel startup retired.");
      }
      const scope = { enabled: ctx.configuration.scoped, unit: process.scope, memoryMax: ctx.configuration.memoryMax, memorySwapMax: ctx.configuration.memorySwapMax };
      const deployment = executable ? { executable, source: ["read-control", "callback", "output", "owned-waits", "owned-fetch", "owned-spawn", "import-packages", "execute", "run-startup"]
        .map((name) => readFileSync(new URL(`../bun-runner/${name}.mjs`, import.meta.url), "utf8")).join("\n"),
        generation, scope, chunkBytes: ctx.options.chunkBytes, startTimeoutMs: ctx.options.startTimeoutMs,
        runtime: { maxMessageBytes: limits.maxBytes, maxImages: ctx.options.maxImages, maxImageBytes: ctx.options.maxImageBytes, maxActiveCells,
          packageRoot: bun?.packages ? bunPackageRoot(ctx.configuration.target, executable, bun.packages) : "" } }
        : { source: readPythonSource(new URL("../runner/", import.meta.url)),
          launcher: readFileSync(new URL("./launch-python.py", import.meta.url), "utf8"),
          forkserverSource: buildForkserver(),
          configuration: { generation, maxActiveCells, processWindow: limits, options: ctx.options, scope, forkserverPreload } };
      const payload = JSON.stringify(deployment) + "\n";
      if (Buffer.byteLength(payload) > limits.maxFrameBytes) throw new Error("Kernel deployment exceeds frame budget.");
      process.deploymentSent = true;
      handle.write(payload);
    });
    await Promise.race([opening.then(() => process.ready.promise), process.ready.promise]);
    if (process.retired || ctx.closed) throw new Error("Kernel startup retired.");
    publish(ctx, { connectionStatus: "connected" });
  } catch (error) {
    await stop(ctx, process, { failure: error });
    throw error;
  } finally { clearTimeout(timer); }

  function fail(error: unknown): void {
    if (process.retired) return;
    void stop(ctx, process, { failure: error }).catch((cleanup) => { console.error("[kernel] Failed generation cleanup unconfirmed:", cleanup); });
  }

  async function releaseUnused(lease: KernelProcess["lease"]) {
    try { await waitBeforeAbort(lease.release(), AbortSignal.timeout(ctx.options.closeTimeoutMs)); }
    catch (error) { console.error("[kernel] Unused startup lease release unconfirmed:", error); }
  }
}

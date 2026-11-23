import { StringDecoder } from "node:string_decoder";
import { openProcess } from "@earendil-works/pi-env";
import type { TargetEnvironmentLease } from "../../target-environment/connection/connection-types.ts";
import { createProcessBootstrap } from "../deployment-source/create-process-bootstrap.ts";
import { parseProcessWindowLimits } from "../../target-environment/process-window/parse-limits.ts";
import type { ProcessWindowLimits } from "../../target-environment/process-window/window-state.ts";
import { DEFAULT_TARGET_CACHE_ROOT } from "../../config/target-cache/target-cache-options.ts";
import type { TargetTransport } from "./transport-types.ts";
import type { ProcessTransportState } from "./transport-state.ts";
import { close } from "./close.ts";
import { receiveOutput } from "./receive-output.ts";
import { subscribeData } from "./subscribe-data.ts";
import { subscribeClose } from "./subscribe-close.ts";
import { write } from "./write.ts";
import { reserveStart } from "./reserve-start.ts";

/** Owns one public SDK process and one environment lease, never the shared Connection. */
export async function openProcessTransport(
  lease: TargetEnvironmentLease,
  python: string,
  cwd: string,
  signal: AbortSignal,
  startTimeoutMs = 10000,
  processWindow: ProcessWindowLimits = parseProcessWindowLimits(),
  env: Record<string, string> = {},
): Promise<TargetTransport> {
  const ctx: ProcessTransportState = {
    lease, limits: processWindow, decoder: new StringDecoder("utf8"), dataListeners: new Set(), closeListeners: new Set(),
    startup: Promise.withResolvers<never>(), process: undefined, pending: [], pendingBytes: 0,
    stderr: Buffer.alloc(0), closed: undefined, closing: undefined, retire: () => {},
  };
  // close() can run after startup; its rejection must always have an observer.
  ctx.startup.promise.catch(() => {});
  let retired = false;
  ctx.retire = () => {
    retired = true;
    void close(ctx, "Target environment generation retired.").catch(() => {});
  };
  const abort = (): void => { void close(ctx, "Target process startup cancelled.").catch(() => {}); };
  lease.signal.addEventListener("abort", ctx.retire, { once: true });
  signal.addEventListener("abort", abort, { once: true });
  let timer: NodeJS.Timeout | undefined;
  try {
    if (typeof cwd !== "string" || !cwd.startsWith("/") || cwd.includes("\0")
      || typeof python !== "string" || !python || python.includes("\0")
      || !Number.isSafeInteger(startTimeoutMs) || startTimeoutMs <= 0 || startTimeoutMs > 2147483647) {
      throw Object.assign(new Error("Process startup requires an absolute NUL-free cwd, a nonempty NUL-free interpreter, and a timeout of 1..2147483647 ms."), { code: "INVALID_REQUEST" });
    }
    timer = setTimeout(() => {
      void close(ctx, "Target process startup timed out.").catch(() => {});
    }, startTimeoutMs);
    signal.throwIfAborted();
    lease.signal.throwIfAborted();
    const argv = [python, "-u", "-c", createProcessBootstrap(processWindow)];
    const confirmStart = reserveStart(lease.connection, cwd, argv, processWindow);
    // openProcess has no signal option. Keep its late handle owned after our bounded startup wait ends.
    const opening = openProcess(lease.connection, {
      cwd, argv, env: { PRK_TARGET_CACHE_ROOT: DEFAULT_TARGET_CACHE_ROOT, ...env },
      onStdout: (bytes) => receiveOutput(ctx, bytes),
      onStderr: (bytes) => {
        if (ctx.closed !== undefined) return;
        const tail = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        ctx.stderr = Buffer.concat([ctx.stderr, tail.subarray(-65536)]).subarray(-65536);
      },
    }).finally(confirmStart).then((handle) => {
      ctx.process = handle;
      handle.exited.then(
        (code) => close(ctx, `Target process exited (${code}).`),
        (error: unknown) => close(ctx, error instanceof Error ? error.message : String(error)),
      ).catch(() => {});
      if (ctx.closed !== undefined) handle.close();
      return handle;
    });
    await Promise.race([opening, ctx.startup.promise]);
    if (ctx.closed !== undefined) throw new Error(ctx.closed);
    signal.throwIfAborted();
    lease.signal.throwIfAborted();
    return {
      write: (data) => write(ctx, data),
      onData: (listener) => subscribeData(ctx, listener),
      onClose: (listener) => subscribeClose(ctx, listener),
      close: () => close(ctx),
    };
  } catch (error) {
    const failure = signal.aborted ? signal.reason : retired ? lease.signal.reason : error;
    await close(ctx, error instanceof Error ? error.message : String(error)).catch(() => {});
    throw failure;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}

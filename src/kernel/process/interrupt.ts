import type { KernelCell, KernelContext } from "../kernel-state.ts";
import type { KernelRestartPolicy } from "../kernel-types.ts";
import { DEFAULT_KERNEL_EXECUTION_POLICY } from "../kernel-options.ts";
import { sendControl } from "../protocol/send-control.ts";
import { stop } from "./stop.ts";
import { ownsFrames } from "../cell/owns-frames.ts";
import { publish } from "../telemetry/publish.ts";
import { waitBeforeAbort } from "./wait-before-abort.ts";
import { controlForkserver } from "./control-forkserver.ts";

export function interrupt(ctx: KernelContext, cell: KernelCell, reason: string, restart?: Exclude<KernelRestartPolicy, "now">): Promise<void> {
  const process = ctx.process;
  if (!process?.pgid || !ownsFrames(ctx, process, cell)) return Promise.resolve();
  const existing = cell.interruption;
  const owned = process;
  if (existing) {
    if (restart !== undefined && existing.restart !== restart) {
      existing.restart = restart;
      escalate();
      if (cell.yielded && !owned.retired) publish(ctx, {});
    }
    return existing.delivery;
  }

  const { interruptTimeoutMs, interruptRestart, maxTimerWaitMs } = ctx.hooks.executionPolicy?.() ?? DEFAULT_KERNEL_EXECUTION_POLICY;
  const elapsed = Promise.withResolvers<void>();
  const finished = Promise.withResolvers<void>();
  const graceDeadline = ctx.clock.now() + interruptTimeoutMs;
  let timerDeadline: number | undefined;
  const ended = new AbortController();
  let cancelDeadline = ctx.clock.schedule(expire, interruptTimeoutMs);
  const interruption = cell.interruption = {
    restart: restart ?? interruptRestart,
    get deadline() { return this.restart === "auto" ? timerDeadline ?? graceDeadline : graceDeadline; },
    expired: elapsed.promise, delivery: finished.promise,
    reconsiderEscalation: escalate,
    observeTimerWait(remainingMs) {
      const now = ctx.clock.now();
      if (this.restart !== "auto" || timerDeadline !== undefined || now >= graceDeadline
        || !Number.isSafeInteger(remainingMs) || remainingMs <= 0 || remainingMs > maxTimerWaitMs) return;
      timerDeadline = Math.max(graceDeadline, now + remainingMs);
    },
    cancelDeadline() { cancelDeadline(); ended.abort(); },
  };
  cell.reason = reason;
  cell.cancelBudget?.();
  cell.callbacks.abort(new Error(reason));
  void deliver().then(finished.resolve, finished.reject);
  if (cell.yielded && !owned.retired) publish(ctx, {});
  return finished.promise;

  function expire() {
    const now = ctx.clock.now();
    if (now >= graceDeadline) {
      elapsed.resolve(); // never keeps its original grace.
      if (couldBeIsolated() && cell.yielded && ownsFrames(ctx, owned, cell)) publish(ctx, {});
    }
    const remaining = Math.ceil((now < graceDeadline ? graceDeadline : timerDeadline ?? graceDeadline) - now);
    if (remaining > 0) cancelDeadline = ctx.clock.schedule(expire, remaining);
    else escalate();
  }

  function escalate() {
    const current = cell.interruption!;
    if (current.restart !== "auto" || ctx.clock.now() < current.deadline || !ownsFrames(ctx, owned, cell)) return;
    // A frozen Python runner can delay output settlement after an independently reaped
    // group. Isolated uncertainty is not authority to stop any sibling.
    if (couldBeIsolated()) return;
    void stop(ctx, owned, { cause: "interrupt-timeout", initiatorCellId: cell.id,
      userStopped: cell.userStopped }).catch((error) => console.error("[kernel] Interrupted generation cleanup unconfirmed:", error));
  }

  function couldBeIsolated() {
    return cell.mode === "isolated" || (cell.mode === undefined && cell.isolatedCandidate === true);
  }

  async function cancelIsolated() {
    const timeoutMs = Math.max(1, Math.ceil(interruptTimeoutMs));
    const signal = AbortSignal.any([owned.retirement.signal, AbortSignal.timeout(timeoutMs)]);
    let status: NonNullable<KernelCell["isolatedStop"]>["status"];
    try { status = await controlForkserver(ctx, owned, { kind: "cancel", cellId: cell.id }, timeoutMs, signal); }
    catch { status = "unconfirmed"; }
    if (ownsFrames(ctx, owned, cell) && couldBeIsolated()) {
      cell.isolatedStop = { status, observedAt: Date.now() };
      if (cell.yielded) publish(ctx, {});
    }
    // This remains necessary for the runner's callback wait and for releasing a
    // pre-fork reservation, even if a natural terminal frame raced the receipt.
    if (status !== "finished") {
      void sendControl(owned, { kind: "cancel", cellId: cell.id }, owned.retirement.signal, () => {}).catch((error) => {
        if (ownsFrames(ctx, owned, cell)) console.error("[kernel] Could not deliver isolated runner cancel:", error);
      });
    }
  }

  async function deliver() {
    const waiting = AbortSignal.any([ended.signal, owned.retirement.signal]);
    try {
      if (!ownsFrames(ctx, owned, cell)) return;
      if (couldBeIsolated()) return await cancelIsolated();
      await sendControl(owned, { kind: "cancel", cellId: cell.id }, waiting, async () => {
        // Only the bundled single-slot runner needs the pre-multicell SIGINT path.
        // A typed runner must never receive a generation-wide signal for a targeted request.
        if (owned.language !== "python" || ctx.runnerMaxActiveCells !== 1 || cell.mode !== undefined || !ownsFrames(ctx, owned, cell)) return;
        const timedOut = new AbortController();
        void elapsed.promise.then(() => timedOut.abort());
        const signal = AbortSignal.any([owned.retirement.signal, timedOut.signal, AbortSignal.timeout(ctx.options.closeTimeoutMs)]);
        try {
          await waitBeforeAbort(owned.lease.connection.request("exec", {
            argv: ["/bin/kill", "-INT", "--", `-${owned.pgid}`], cwd: ctx.configuration.cwd,
          }, { signal }), signal);
        } catch (error) {
          if (!signal.aborted) throw error;
        }
      });
    } catch (error) {
      if (waiting.aborted) return;
      if (couldBeIsolated()) throw error;
      void stop(ctx, owned, { failure: error }).catch((cleanup) => console.error("[kernel] Interrupt transport cleanup unconfirmed:", cleanup));
      throw error;
    }
  }
}

import type { KernelContext, KernelProcess } from "../kernel-state.ts";
import type { KernelRetirementReceipt, KernelRetirementRequest } from "../kernel-types.ts";
import { publish } from "../telemetry/publish.ts";

export function retire(ctx: KernelContext, process: KernelProcess, error: unknown, command?: KernelRetirementRequest) {
  process.retired = true;
  process.window.retire(error);
  process.pendingRequests.clear();
  process.ready.reject(error);
  process.detach();
  const cells = [...ctx.cells.values()];
  if (ctx.maintenance) cells.push(ctx.maintenance);
  const submitted = cells.filter((cell) => cell.kernelId === process.generation && cell.requestId !== undefined);
  const affected = submitted.filter((cell) => cell.outcome === undefined);
  const retirement: KernelRetirementReceipt | undefined = command && Object.freeze({
    kernelId: process.generation, reason: "kernel 重启", cause: command.cause,
    ...(command.initiatorCellId === undefined ? {} : { initiatorCellId: command.initiatorCellId }),
    affectedCells: Object.freeze(affected.filter((cell) => cell !== ctx.maintenance).map((cell) => Object.freeze({
      kernelId: process.generation, cellId: cell.id, taskName: cell.taskName!,
    }))),
  });
  process.retirementReceipt = retirement;
  for (const cell of affected) {
    if (command?.userStopped) cell.userStopped = true;
    if (command?.cause === "interrupt-timeout" && command.initiatorCellId === cell.id && cell.mode === "thread") cell.suggestedMode = "isolated";
  }
  process.retirement.abort(error);
  for (const cell of affected) {
    cell.cancelBudget?.();
    cell.interruption?.cancelDeadline();
    cell.detachSignal?.();
    clearTimeout(cell.progressTimer);
    cell.callbacks.abort(error);
  }
  announce();
  return {
    receipt: retirement,
    released: Promise.all(submitted.map((cell) => cell.released.promise)),
    settle(confirmed: boolean) {
      const terminal = confirmed ? retirement : undefined;
      for (const cell of affected) {
        if (terminal) {
          cell.retirement = terminal;
          cell.reason = terminal.reason;
        } else cell.reason ??= error instanceof Error ? error.message : String(error);
        cell.resolve(terminal ? "aborted" : "unknown");
      }
      announce(affected.length ? (terminal ? "aborted" : "unknown") : undefined);
    },
  };

  function announce(lastOutcome?: "aborted" | "unknown") {
    if (ctx.process !== process) return;
    publish(ctx, { state: ctx.closed ? "closing" : "unavailable", connectionStatus: "disconnected", namespace: undefined,
      ...(lastOutcome === undefined ? {} : { lastOutcome }) });
  }
}

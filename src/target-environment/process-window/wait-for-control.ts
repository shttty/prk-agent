import { once } from "node:events";
import { CONTROL_CONSUMED, type ProcessWindowState } from "./window-state.ts";

export function waitForControl(ctx: ProcessWindowState, control: string, signal: AbortSignal): Promise<void> | undefined {
  const slot = ctx.controls?.get(control);
  if (!slot?.bytes) return;
  return waitForReceipt((slot.receipt ??= new AbortController()).signal, signal);
}

async function waitForReceipt(receipt: AbortSignal, signal: AbortSignal): Promise<void> {
  // Each sender subscribes to its own combined signal. Revocation ends that wait,
  // but only confirmation or retirement can settle the receipt shared by senders.
  const wake = AbortSignal.any([receipt, signal]);
  if (!wake.aborted) await once(wake, "abort");
  signal.throwIfAborted();
  if (receipt.reason !== CONTROL_CONSUMED) throw receipt.reason;
}

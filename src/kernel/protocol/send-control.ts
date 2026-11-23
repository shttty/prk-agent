import type { KernelProcess } from "../kernel-state.ts";
import type { KernelControl } from "./assemble-kernel-window.ts";
import { send } from "./send.ts";

export async function sendControl<T>(process: KernelProcess, payload: Record<string, unknown> & { kind: KernelControl },
  signal: AbortSignal, afterWrite: (id: number) => T): Promise<T> {
  for (;;) {
    signal.throwIfAborted();
    const receipt = process.window.waitForControl(payload.kind, signal);
    if (!receipt) break;
    await receipt;
  }
  // No await from the free-slot check through reservation and write. An awakened
  // sibling rechecks the current slot before it allocates an ID or writes.
  return afterWrite(send(process, payload));
}

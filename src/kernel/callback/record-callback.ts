import type { KernelCell } from "../kernel-state.ts";

export function recordCallback(cell: KernelCell, callback: KernelCell["details"]["callbacks"][number]): void {
  const summaries = cell.yielded ? cell.lateCallbacks : cell.details.callbacks;
  if (summaries.length >= 128) { cell.callbacksTruncated = true; return; }
  summaries.push(callback);
}

import type { SessionManager } from "@earendil-works/pi-coding-agent";
import type { KernelCellReceipt } from "./delivery-types.ts";

// Only failed writes need retention. Saved results always come from the native manager.
const unsaved = new WeakMap<SessionManager, Map<string, KernelCellReceipt>>();

export function retainUnsavedCell(manager: SessionManager, receipt: KernelCellReceipt): void {
  let cells = unsaved.get(manager);
  if (!cells) unsaved.set(manager, cells = new Map());
  cells.set(receipt.cellId, receipt);
}

export function readUnsavedCell(manager: SessionManager, id: string): KernelCellReceipt | undefined {
  return unsaved.get(manager)?.get(id);
}

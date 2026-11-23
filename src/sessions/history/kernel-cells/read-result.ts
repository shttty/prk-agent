import type { SessionManager } from "@earendil-works/pi-coding-agent";
import type { KernelCellResult } from "../../../kernel/kernel-types.ts";
import { readCellEntries } from "./read-cell-entries.ts";
import { readUnsavedCell } from "./retain-unsaved-cell.ts";

export function readSavedCellResult(manager: SessionManager, id: string): KernelCellResult | undefined {
  return readCellEntries(manager, id).get(id)?.result?.result;
}

export function readCellResult(manager: SessionManager, id: string): KernelCellResult | undefined {
  const cell = readCellEntries(manager, id).get(id);
  if (cell) return cell.result?.result ?? readUnsavedCell(manager, id)?.result;
}

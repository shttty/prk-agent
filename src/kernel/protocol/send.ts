import type { KernelCell, KernelProcess } from "../kernel-state.ts";
import { encodeCommand } from "./encode-command.ts";

const cellUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export function send(process: KernelProcess, payload: Record<string, unknown>, cell?: KernelCell): number {
  if (process.retired || !process.process) throw new Error("Kernel generation is unavailable.");
  const id = process.requestId + 1;
  if (!Number.isSafeInteger(id) || id < 1) {
    throw Object.assign(new Error("Kernel request id must be a positive safe integer."), { code: "INVALID_REQUEST" });
  }
  const { kind, cellId, requestId } = payload;
  const control = kind === "cancel" || kind === "callback_reply_chunk" ? kind : undefined;
  if (control !== undefined && (typeof cellId !== "string" || !cellUuid.test(cellId))) {
    throw Object.assign(new Error(`Kernel ${control} requires a UUID cellId.`), { code: "INVALID_REQUEST" });
  }
  if (typeof cellId !== "string") throw new Error("Kernel command requires a cell identity.");
  if (control === "callback_reply_chunk" && (typeof requestId !== "number" || !Number.isSafeInteger(requestId) || requestId < 1)) {
    throw Object.assign(new Error("Kernel callback reply requestId must be a positive safe integer."), { code: "INVALID_REQUEST" });
  }
  const line = encodeCommand(process.generation, id, payload);
  process.window.reserve(id, Buffer.byteLength(line), control);
  process.requestId = id;
  process.pendingRequests.set(id, { cellId, control: control !== undefined });
  if (cell) cell.requestId = id;
  try { process.process.write(line); }
  catch (error) {
    process.pendingRequests.delete(id);
    process.window.confirm(id);
    if (cell) cell.requestId = undefined;
    throw error;
  }
  return id;
}

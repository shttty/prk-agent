import { isPayload } from "../../../payload/is-payload.ts";
import type { Payload } from "../../../payload/is-payload.ts";
import type { ChatActions } from "../../../thread/chat-actions-types.ts";
import type { KernelCellRef } from "./kernel-image-types.ts";
import { sameCell } from "./same-cell.ts";

/** One image of a cell's final result when `imageIndex` is given, else the whole result message. */
export async function loadKernelResult(api: ChatActions["api"], cell: Pick<KernelCellRef, "sessionId" | "cellId">, imageIndex?: number): Promise<Payload & { content: unknown[] }> {
  const query = new URLSearchParams({ cellId: cell.cellId });
  if (imageIndex !== undefined) query.set("imageIndex", String(imageIndex));
  // Boundary: the Gateway's reply.
  const value: unknown = await api.get(`/sessions/${encodeURIComponent(cell.sessionId)}/kernel/result?${query}`);
  if (!sameCell(value, cell)) throw new Error("执行结果不属于当前 cell。");
  if (!isPayload(value) || !isPayload(value.result)) throw new Error("执行结果尚不可用。");
  return { ...value.result, content: Array.isArray(value.result.content) ? value.result.content : [] };
}

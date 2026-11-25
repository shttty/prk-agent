import { sameCell } from "./same-cell.js";

export async function loadKernelResult(api, cell, imageIndex) {
  const query = new URLSearchParams({ cellId: cell.cellId });
  if (imageIndex !== undefined) query.set("imageIndex", imageIndex);
  const value = await api.get(`/sessions/${encodeURIComponent(cell.sessionId)}/kernel/result?${query}`);
  if (!sameCell(value, cell)) throw new Error("执行结果不属于当前 cell。");
  if (!value.result) throw new Error("执行结果尚不可用。");
  return value.result;
}

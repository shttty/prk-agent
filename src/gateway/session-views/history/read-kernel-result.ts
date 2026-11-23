import type { HostContext } from "../../host/host-state.ts";
import type { KernelResultView } from "./kernel-result-types.ts";
import { readCellDelivery } from "../../../sessions/history/kernel-cells/read-deliveries.ts";
import { readCellResult } from "../../../sessions/history/kernel-cells/read-result.ts";
import { WireError } from "../../wire/create-error.ts";

export function kernelResult(ctx: HostContext, sessionId: string, cellId: string, imageIndex?: number): KernelResultView {
  const entry = ctx.host.history.get(sessionId);
  if (!entry) throw new WireError("NOT_FOUND", "Session history is not managed by this Gateway routing identity.");
  const runtime = !entry.archived && !entry.sleeping ? ctx.host.collection.get(sessionId) : undefined;
  const manager = runtime?.session.sessionManager ?? entry.manager;
  const delivery = readCellDelivery(manager, cellId, runtime?.kernel.getSnapshot().activeCells);
  if (!delivery) throw new WireError("NOT_FOUND", "Cell is not present in this SDK session branch.");
  const result = readCellResult(manager, cellId);
  let imageCount = 0;
  const projectedResult = result && { ...result, content: result.content.filter((part) => part.type !== "image" || ++imageCount === imageIndex) };
  if (imageIndex !== undefined && imageCount < imageIndex) throw new WireError("NOT_FOUND", "No retained image at that index.");
  return { sessionId, ...delivery, ...(projectedResult ? { result: projectedResult } : {}) };
}

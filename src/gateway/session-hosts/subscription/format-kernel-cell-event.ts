import type { SessionHostEvent } from "../../../sessions/host/host-types.ts";
import type { KernelActiveCell } from "../../../kernel/kernel-types.ts";
import type { HostBindingContext } from "../host-binding-state.ts";
import { object } from "../../wire/is-record.ts";
import { listCellDeliveries } from "../../../sessions/history/kernel-cells/read-deliveries.ts";

export function projectKernelCellEvent(ctx: HostBindingContext, event: SessionHostEvent): SessionHostEvent {
  const kernel = event.details?.kernel;
  const message = event.details?.message;
  const finished = event.type === "session_event" && event.details?.sdkType === "message_end" && object(message)
    && message.role === "custom" && message.customType === "kernel-event" && object(message.details) && message.details.kind === "finished";
  // Wake-path message_end precedes the native append; an autonomous turn has no operation_completed snapshot.
  const settled = event.type === "session_event" && event.details?.sdkType === "agent_settled" && !event.operationId;
  let activeCells: readonly KernelActiveCell[] | undefined;
  if (event.type === "state_changed" && object(kernel) && Array.isArray(kernel.activeCells)) {
    activeCells = kernel.activeCells;
    const previous = ctx.kernelCellProjection;
    if (previous?.streamId === event.streamId && previous.activeIds.length === activeCells.length
      && activeCells.every(({ cellId }, i) => cellId === previous.activeIds[i])) return event;
    ctx.kernelCellProjection = { streamId: event.streamId, activeIds: activeCells.map(({ cellId }) => cellId) };
  } else if (!finished && !settled) return event;
  const runtime = ctx.parent.host.collection.get(ctx.sessionId);
  if (!runtime) return event;
  const kernelCells = listCellDeliveries(runtime.session.sessionManager, activeCells ?? runtime.kernel.getSnapshot().activeCells);
  if (settled && kernelCells.length === 0) return event;
  return { ...event, details: { ...event.details, kernelCells } };
}

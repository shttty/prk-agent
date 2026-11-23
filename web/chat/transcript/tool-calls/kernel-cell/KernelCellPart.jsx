import { useContext } from "react";
import { useWorkbench } from "../../../../workbench/subscription/use-workbench.js";
import { PresentationContext } from "../../presentation-context.js";
import { kernelCellPresentation } from "./kernel-cell-presentation.js";
import { selectKernelEvent } from "./select-kernel-event.js";

export function KernelCellPart({ Row, ...props }) {
  const context = useContext(PresentationContext);
  const sessionId = context?.sessionId;
  const delivery = useWorkbench((state) => state.session.snapshot?.sessionId === sessionId
    ? state.session.snapshot.kernelCells?.find((cell) => cell.toolCallId === props.toolCallId) : null);
  const active = useWorkbench((state) => state.session.snapshot?.sessionId === sessionId
    ? state.session.snapshot.kernel?.activeCells?.find((cell) => cell.toolCallId === props.toolCallId) ?? null : null);
  const checkpoint = useWorkbench((state) => state.session.snapshot?.sessionId === sessionId
    ? selectKernelEvent(state.session.snapshot.messages, sessionId, props.toolCallId, "checkpoint", delivery || active) : null);
  const finished = useWorkbench((state) => state.session.snapshot?.sessionId === sessionId
    ? selectKernelEvent(state.session.snapshot.messages, sessionId, props.toolCallId, "finished", delivery || active) : null);
  const cell = kernelCellPresentation({ sessionId, toolCallId: props.toolCallId, delivery, active, checkpoint, finished });
  return <Row {...props} kernelCell={cell} />;
}

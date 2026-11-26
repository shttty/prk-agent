import { useContext } from "react";
import type { ComponentType } from "react";
import { useWorkbench } from "../../../../workbench/subscription/use-workbench.ts";
import { PresentationContext } from "../../presentation-context.ts";
import type { ToolRowProps } from "../tool-row-types.ts";
import { kernelCellPresentation } from "./kernel-cell-presentation.ts";
import { selectKernelEvent } from "./select-kernel-event.ts";

export function KernelCellPart({ Row, ...props }: ToolRowProps & { Row: ComponentType<ToolRowProps> }) {
  const context = useContext(PresentationContext);
  const sessionId = context?.sessionId;
  const delivery = useWorkbench((state) => state.session.snapshot?.sessionId === sessionId
    ? state.session.snapshot?.kernelCells?.find((cell) => cell.toolCallId === props.toolCallId) : null);
  const active = useWorkbench((state) => state.session.snapshot?.sessionId === sessionId
    ? state.session.snapshot?.kernel?.activeCells?.find((cell) => cell.toolCallId === props.toolCallId) ?? null : null);
  const checkpoint = useWorkbench(({ session: { snapshot } }) => snapshot && sessionId && snapshot.sessionId === sessionId
    ? selectKernelEvent(snapshot.messages, sessionId, props.toolCallId, "checkpoint", delivery || active) : undefined);
  const finished = useWorkbench(({ session: { snapshot } }) => snapshot && sessionId && snapshot.sessionId === sessionId
    ? selectKernelEvent(snapshot.messages, sessionId, props.toolCallId, "finished", delivery || active) : undefined);
  const cell = kernelCellPresentation({ sessionId, toolCallId: props.toolCallId, delivery, active, checkpoint, finished });
  return <Row {...props} kernelCell={cell} />;
}

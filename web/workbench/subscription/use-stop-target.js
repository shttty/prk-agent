import { useWorkbench } from "./use-workbench.js";

// Select strings, not the cell object: activeCells is a new array on every kernel telemetry tick.
const lone = (state) => {
  const cells = state.session.snapshot?.kernel?.activeCells;
  return cells?.length === 1 ? cells[0] : undefined;
};

/** Whole-turn stop of the selected session. Only a lone live cell is carried; with several, none is picked for the user. */
export function useStopTarget() {
  const sessionId = useWorkbench((state) => state.selectedSessionId);
  const streamId = useWorkbench((state) => state.session.streamId);
  const operationId = useWorkbench((state) => state.session.snapshot?.operation?.operationId);
  const kernelId = useWorkbench((state) => lone(state)?.kernelId);
  const cellId = useWorkbench((state) => lone(state)?.cellId);
  if (!sessionId || (!operationId && !cellId)) return null;
  return { sessionId, streamId, operationId, cell: kernelId && cellId ? { kernelId, cellId } : undefined };
}

import type { AskPrompt } from "./ask-types.ts";

type CellRef = { kernelId: string; cellId: string };
export type StopTarget = { sessionId: string; streamId?: string | null; operationId?: string; cellOnly?: boolean; cell?: CellRef };

/** Stop target of an ask card. An ask raised by a yielded cell stops only that cell (`cellOnly`); a foreground ask
 * stops the turn and names its own cell instead of a guessed one. */
export function askStopTarget(prompt: Pick<AskPrompt, "kernelId" | "cellId">, stopTarget: StopTarget | null, { sessionId, streamId, activeCells }: { sessionId: string | null; streamId: string | null; activeCells: readonly CellRef[] | undefined }): StopTarget | null {
  const cell = prompt.kernelId && prompt.cellId ? { kernelId: prompt.kernelId, cellId: prompt.cellId } : null;
  if (!cell) return stopTarget;
  if (sessionId && activeCells?.some((item) => item.kernelId === cell.kernelId && item.cellId === cell.cellId)) return { sessionId, streamId, cellOnly: true, cell };
  return stopTarget?.operationId ? { ...stopTarget, cell } : stopTarget;
}

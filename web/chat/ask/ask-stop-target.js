/** Stop target of an ask card. An ask raised by a yielded cell stops only that cell (`cellOnly`); a foreground ask
 * stops the turn and names its own cell instead of a guessed one. */
export function askStopTarget(prompt, stopTarget, { sessionId, streamId, activeCells }) {
  const cell = prompt.kernelId && prompt.cellId ? { kernelId: prompt.kernelId, cellId: prompt.cellId } : null;
  if (!cell) return stopTarget;
  if (activeCells?.some((item) => item.kernelId === cell.kernelId && item.cellId === cell.cellId)) return { sessionId, streamId, cellOnly: true, cell };
  return stopTarget?.operationId ? { ...stopTarget, cell } : stopTarget;
}

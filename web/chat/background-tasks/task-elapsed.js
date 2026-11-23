export function taskElapsed(task, now) {
  if (task.kind === "terminal") return Math.max(0, now - task.startedAt);
  return (task.activeMs ?? 0) + (task.waitingForAsk || task.stopped ? 0 : Math.max(0, now - task.startedAt - (task.elapsedMs ?? 0)));
}

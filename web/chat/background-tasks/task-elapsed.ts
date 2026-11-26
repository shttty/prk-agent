import type { BackgroundTask } from "./background-task-types.ts";

export function taskElapsed(task: BackgroundTask, now: number) {
  if (task.kind === "terminal") return Math.max(0, now - task.startedAt);
  return (task.activeMs ?? 0) + (task.waitingForAsk ? 0 : Math.max(0, now - task.startedAt - (task.elapsedMs ?? 0)));
}

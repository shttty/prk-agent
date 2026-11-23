import type { DerivedSessionInfo } from "../../plugins/sessions/session-types.ts";

export interface TaskTiming {
  /** Admitted run or derived task start, epoch milliseconds. */
  readonly startedAt?: number;
  /** Child result submission or explicit task end, absent while unfinished. */
  readonly finishedAt?: number;
}

export function readTaskTiming(task: DerivedSessionInfo | undefined, archivedAt?: string): TaskTiming {
  if (!task) return {};
  const finishedAt = task.result?.finishedAt ?? (archivedAt === undefined ? undefined : Date.parse(archivedAt));
  return {
    ...(task.startedAt === undefined ? {} : { startedAt: task.startedAt }),
    ...(finishedAt === undefined ? {} : { finishedAt }),
  };
}

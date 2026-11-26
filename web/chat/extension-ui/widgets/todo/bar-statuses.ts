import type { TodoData, TodoStatus } from "./todo-types.ts";
import { BAR_ORDER } from "./todo-constants.ts";
/** One bar segment per task, grouped by status; tasks a fold or a folded phase hid were closed, counted as completed. */
export function barStatuses(data: TodoData): TodoStatus[] {
  const counts: Record<TodoStatus, number> = { completed: 0, cancelled: 0, in_progress: 0, blocked: 0, pending: 0 };
  for (const phase of data.phases) for (const task of phase.tasks) counts[task.status] += 1;
  counts.completed += Math.max(0, data.done - counts.completed - counts.cancelled);
  return BAR_ORDER.flatMap((status) => Array.from({ length: counts[status] }, () => status));
}

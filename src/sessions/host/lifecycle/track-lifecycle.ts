import type { HostContext } from "../host-types.ts";

export function lifecycle(ctx: HostContext, action: () => Promise<void>): Promise<void> {
  if (ctx.closing) return Promise.reject(new Error("Session host is closed."));
  const task = action();
  ctx.lifecycleTasks.add(task);
  void task.then(() => ctx.lifecycleTasks.delete(task), () => ctx.lifecycleTasks.delete(task));
  return task;
}

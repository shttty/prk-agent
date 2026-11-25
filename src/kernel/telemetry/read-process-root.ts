import type { KernelContext } from "../kernel-state.ts";

export function processRoot(ctx: KernelContext) {
  const current = ctx.process;
  if (!current?.pid || current.retired) return undefined;
  return { pid: current.pid, infrastructurePid: current.forkserverPid };
}

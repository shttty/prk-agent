import { listKernelProcesses } from "../target-instances/list-kernel-processes.mjs";

/** Live REPL processes (pids) under the owned fixture directory: the sentinel and every session cwd sit below it. */
export async function kernelIds(ctx) {
  return listKernelProcesses(ctx.config.python, ctx.fixtureRoot);
}

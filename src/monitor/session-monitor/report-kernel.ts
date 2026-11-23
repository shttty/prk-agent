import type { MonitorContext } from "./monitor-state.ts";
import type { KernelSnapshot } from "../../kernel/kernel-types.ts";
import { memoryLimitBytes } from "../../config/kernel/parse-memory-limit-bytes.ts";
import { publish } from "./subscriptions/publish.ts";

export function reportKernel(ctx: MonitorContext, sessionId: string, kernel: KernelSnapshot | undefined): void {
  const rec = ctx.sessions.get(sessionId);
  if (!rec) return;
  const memory = kernel?.memory;
  let limit = 0;
  try { limit = memory ? memoryLimitBytes(memory.memoryMax) : 0; } catch { /* no usable limit: no pressure alert */ }
  const next = {
    kernel: kernel !== undefined && (kernel.state === "failed" || kernel.state === "unavailable"),
    oom: (memory?.oomKill ?? 0) > 0,
    memory: memory !== undefined && limit > 0 && memory.workingSet / limit * 100 >= ctx.options.memoryAlertPercent,
  };
  if (next.kernel === rec.alerts.kernel && next.oom === rec.alerts.oom && next.memory === rec.alerts.memory) return;
  rec.alerts = next;
  publish(ctx, sessionId);
}

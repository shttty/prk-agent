import type { HostContext } from "../host/host-state.ts";
import type { ProcessRoot } from "../../monitor/telemetry/process-types.ts";

export function processRoots(ctx: HostContext, sessionId: string): ProcessRoot[] {
  const roots: ProcessRoot[] = [];
  const kernel = ctx.host.collection.get(sessionId)?.kernel;
  const root = kernel?.processRoot?.();
  if (kernel && root) roots.push({ ...root, kind: "kernel", running: kernel.getSnapshot().state === "busy" });
  for (const terminal of ctx.workspace.modelTerminals.get(sessionId)?.getSnapshot() ?? []) {
    if (terminal.owner !== "model") continue;
    const pid = ctx.workspace.terminals.modelShellPid(sessionId, terminal.name);
    if (pid !== undefined) roots.push({ kind: "terminal", pid, running: terminal.runningCommand !== undefined });
  }
  return roots;
}

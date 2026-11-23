import type { MonitorContext } from "./monitor-state.ts";
import type { FileDiff } from "./session-monitor-types.ts";

export async function diff(ctx: MonitorContext, sessionId: string, path: string): Promise<FileDiff> {
  const rec = ctx.sessions.get(sessionId);
  if (!rec || rec.cwd === undefined) throw new Error("Session has no watched directory.");
  if (rec.dir && !rec.dir.value.git) return { kind: "agent", text: ctx.deps.agentDiff(sessionId, path) };
  const machine = rec.machine === undefined ? undefined : ctx.machines.get(rec.machine);
  if (!machine?.lease || machine.state !== "ok") throw new Error("Collector is not running.");
  const reply = await machine.lease.request("monitor", "diff", { dir: rec.cwd, path });
  if (reply.error) throw new Error(String(reply.error));
  return { kind: "git", text: String(reply.text), truncated: reply.truncated === true };
}

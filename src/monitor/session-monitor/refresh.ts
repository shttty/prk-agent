import type { MonitorContext } from "./monitor-state.ts";
import { request } from "./connection/request.ts";
import { publish } from "./subscriptions/publish.ts";

export function refresh(ctx: MonitorContext, sessionId: string): void {
  const rec = ctx.sessions.get(sessionId);
  if (!rec || rec.machine === undefined || rec.cwd === undefined || !ctx.options.enabled) return;
  clearTimeout(rec.refreshTimer);
  rec.refreshTimer = setTimeout(() => {
    rec.refreshTimer = undefined;
    if (rec.cwd === undefined) return;
    const machine = ctx.machines.get(rec.machine ?? "");
    // The collector re-asks git too, so a `git init` run by the tool turns the agent source into a git one; its
    // reply for a non-git directory recomputes the agent source. Without a collector only that part is possible.
    if (machine?.lease) request(ctx, machine, "refresh", { dir: rec.cwd });
    else if (rec.dir && !rec.dir.value.git) {
      rec.agent = { at: ctx.now(), value: ctx.deps.agentChanges(sessionId) };
      publish(ctx, sessionId);
    }
  }, ctx.options.refreshDebounceMs);
  rec.refreshTimer.unref?.();
}

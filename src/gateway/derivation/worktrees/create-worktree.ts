import type { HostContext } from "../../host/host-state.ts";
import type { DerivedSessionInfo } from "../../../plugins/sessions/session-types.ts";

export async function createWorktree(ctx: HostContext, target: string, cwd: string, sessionId: string) {
  const lease = ctx.host.channels.acquire(target);
  try {
    const result = await lease.request("worktrees", "create", { cwd, sessionId });
    for (const key of ["repoRoot", "worktreeRoot", "baseCommit", "parentState", "cwd"] as const) {
      if (typeof result[key] !== "string" || !result[key]) throw new Error(`Target returned invalid worktree ${key}.`);
    }
    return result as Required<Pick<DerivedSessionInfo, "repoRoot" | "worktreeRoot" | "baseCommit" | "parentState">> & { isolated: true; cwd: string };
  } finally { await lease.release(); }
}

import type { HostContext } from "../../host/host-state.ts";
import { readDerivedSession } from "../../../sessions/derivation/read-derived-session.ts";

export async function removeWorktree(ctx: HostContext, sessionId: string): Promise<void> {
  const entry = ctx.methods.storedSession(sessionId);
  const state = readDerivedSession(entry.manager, ctx.derivation.derivationSchemas);
  if (!state?.isolated || state.lifecycle === "user") return;
  try {
    const lease = ctx.host.channels.acquire(entry.target);
    try { await lease.request("worktrees", "remove", { repoRoot: state.repoRoot, worktreeRoot: state.worktreeRoot }); }
    finally { await lease.release(); }
  } catch (error) {
    console.error(`Worktree cleanup failed for ${sessionId}; session will still be archived.`, error);
  }
}

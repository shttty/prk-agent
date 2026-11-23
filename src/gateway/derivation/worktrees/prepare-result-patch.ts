import { mkdir, open, rename, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { HostContext } from "../../host/host-state.ts";
import type { DerivedSessionInfo } from "../../../plugins/sessions/session-types.ts";

export async function prepareResultPatch(ctx: HostContext, sessionId: string, state: DerivedSessionInfo): Promise<NonNullable<DerivedSessionInfo["result"]>["patch"]> {
  if (!state.isolated) return;
  const entry = ctx.methods.storedSession(sessionId);
  const { repoRoot, worktreeRoot, baseCommit, parentState } = state;
  if (!repoRoot || !worktreeRoot || !baseCommit || !parentState) throw new Error("Isolated session has incomplete worktree metadata.");
  const path = join(ctx.host.paths.home, "artifacts", "patches", `${entry.sessionId}-${state.taskId}.patch`);
  const lease = ctx.host.channels.acquire(entry.target);
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    const patch = await lease.request("worktrees", "patch", { repoRoot, worktreeRoot, baseCommit, parentState, path });
    if (patch.path === undefined) return;
    if (patch.path !== path || typeof patch.bytes !== "number" || !Number.isSafeInteger(patch.bytes) || patch.bytes <= 0 || patch.bytes > 16 * 1024 * 1024 || typeof patch.stats !== "string") throw new Error("Target returned invalid patch metadata.");
    await mkdir(dirname(path), { recursive: true });
    const file = await open(temporary, "wx");
    try {
      for (let offset = 0; offset < patch.bytes;) {
        const chunk = await lease.request("worktrees", "readPatch", { path, offset });
        if (typeof chunk.data !== "string") throw new Error("Target returned invalid patch chunk.");
        const bytes = Buffer.from(chunk.data, "base64");
        if (!bytes.length || bytes.length > 192 * 1024 || offset + bytes.length > patch.bytes) throw new Error("Target patch transfer length mismatch.");
        await file.writeFile(bytes);
        offset += bytes.length;
      }
    } finally { await file.close(); }
    await rename(temporary, path);
    return { path, bytes: patch.bytes, stats: patch.stats };
  } finally {
    await rm(temporary, { force: true });
    await lease.release();
  }
}

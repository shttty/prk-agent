import type { ManagedSessionSnapshot } from "../collection-types.ts";
import type { CollectionContext } from "../collection-state.ts";

export function snapshot(ctx: CollectionContext): readonly ManagedSessionSnapshot[] { return Object.freeze(
    [...ctx.records.values()].map((record) => Object.freeze({
      sessionId: record.sessionId,
      cwd: record.cwd,
      target: record.target.id,
      label: record.sessionManager.getSessionName() ?? record.sessionId,
      state: record.state,
      ...record.session?.host.attention,
      ...(record.session ? { requiresReload: record.session.requiresReload } : {}),
      ...(record.state === "running" && record.session?.host.operationKind === "compact" ? { compacting: true } : {}),
      ...(record.session?.host.startedAt === undefined ? {} : { startedAt: record.session.host.startedAt }),
      ...(record.session?.kernel ? { kernel: record.session.kernel.getSnapshot() } : {}),
    })),
  ) as readonly ManagedSessionSnapshot[]; }

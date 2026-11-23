import type { SessionRuntime } from "../../runtime/runtime-types.ts";
import type { SessionRecord } from "../collection-types.ts";
import { emit } from "../subscriptions/publish-lifecycle.ts";
import { runtimeDependencies } from "./resolve-runtime-dependencies.ts";
import { attachObservers } from "../subscriptions/attach-observers.ts";
import type { CollectionContext } from "../collection-state.ts";

export function startSession(ctx: CollectionContext, record: SessionRecord): Promise<SessionRuntime> {
    if (record.tombstoned || ctx.closed) {
      return Promise.reject(new Error(`Session ${JSON.stringify(record.sessionId)} is permanently closed.`));
    }
    if (record.pending) return record.pending;
    if (record.session) return Promise.resolve(record.session);
    record.state = "starting";
    const pending = Promise.resolve().then(async () => {
      const base = await runtimeDependencies(ctx);
      const dependencies = ctx.options.configureRuntimeDependencies
        ? await ctx.options.configureRuntimeDependencies(record.sessionId, base, record.sessionManager)
        : base;
      const sessionDependencies = { ...dependencies, sessionManager: record.sessionManager };
      const runtimeTarget = record.cwd === record.target.kernel.cwd
        ? record.target
        : { ...record.target, kernel: { ...record.target.kernel, cwd: record.cwd } };
      return ctx.sessionFactory(runtimeTarget, sessionDependencies);
    });
    record.pending = pending;
    void pending.then((session) => {
      record.session = session;
      if (!(record.tombstoned || ctx.closed)) attachObservers(ctx, record, session);
      if (!(record.tombstoned || ctx.closed)) {
        record.state = "idle";
        emit(ctx, "session_idle", record);
      }
      if (record.pending === pending) record.pending = undefined;
    }, () => {
      if (record.pending === pending) record.pending = undefined;
      // No runtime was built (createSession owns its cleanup): the record is closed and the next use starts again.
      if (!record.tombstoned && !ctx.closed) record.state = "closed";
    });

    emit(ctx, "session_starting", record);
    return pending;
  }

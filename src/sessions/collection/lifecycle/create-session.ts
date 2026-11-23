import { requireConfigured } from "../../../config/execution-target/require-configured.ts";
import type { SessionManager } from "@earendil-works/pi-coding-agent";
import { isAbsoluteCwd } from "../../../config/execution-target/is-absolute-cwd.ts";
import type { SessionRuntime } from "../../runtime/runtime-types.ts";
import { log } from "./log-lifecycle.ts";
import type { SessionCreateOptions } from "../collection-types.ts";
import { validSessionCwd } from "../targets/validate-cwd.ts";
import { newRecord } from "../records/create-record.ts";
import { startSession } from "./start-runtime.ts";
import { closeRecord } from "./close-record.ts";
import { resetRecord } from "./reset-record.ts";
import type { CollectionContext } from "../collection-state.ts";

export async function create(ctx: CollectionContext, targetName: string, sessionManager: SessionManager, options: SessionCreateOptions): Promise<SessionRuntime> {
      if (ctx.closed) throw new Error("Session collection is closed.");
      const target = ctx.configured.get(targetName);
      if (!target) throw new Error("Unknown execution target.");
      requireConfigured(target);
      const requestedCwd = options.cwd ?? target.kernel.cwd;
      if (!validSessionCwd(requestedCwd, ctx.limits.cwdChars) || !isAbsoluteCwd(requestedCwd)) {
        throw new Error("Session creation requires an absolute cwd.");
      }
      const sessionId = sessionManager.getSessionId();
      let record = ctx.records.get(sessionId);
      if (record && record.target !== target) throw new Error("Session identity is already bound to another target.");
      if (record && options.mode === undefined && options.cwd !== undefined && record.cwd !== requestedCwd) {
        throw new Error("Session identity is already bound to a different cwd.");
      }
      if (record?.requiresRecovery && options.mode === undefined) {
        throw new Error("Session requires an explicit recovery mode.");
      }
      if (record && record.sessionManager !== sessionManager) {
        throw new Error("Session identity is already bound to another session manager.");
      }
      if (!record) {
        record = newRecord(sessionManager, target, requestedCwd);
        ctx.records.set(sessionId, record);
      } else if (options.mode !== undefined) {
        record.cwd = requestedCwd;
      }
      const owned = record;
      if ((options.mode === "new" || options.mode === "wake") && (owned.session || owned.pending)) await resetRecord(ctx, owned);
      const session = await startSession(ctx, owned);
      if (ctx.closed || owned.tombstoned || owned.state === "closing") {
        await closeRecord(ctx, owned);
        throw new Error(`Session ${JSON.stringify(sessionId)} closed during creation.`);
      }
      if (options.mode !== undefined) {
        if (!session.kernel) {
          owned.requiresRecovery = true;
          throw new Error("Session kernel recovery is unavailable in this runtime.");
        }
        try { await session.kernel.ensure(); }
        catch (error) {
          owned.requiresRecovery = true;
          throw error;
        }
        owned.requiresRecovery = false;
      }
      log(sessionId, `session created on target ${JSON.stringify(targetName)}`);
      return session;
    }

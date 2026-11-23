import type { HostContext } from "../host/host-state.ts";
import type { GatewaySessionHost } from "../host/host-types.ts";
import { WireError } from "../wire/create-error.ts";
import { readSessionDerivation } from "../session-views/readability/read-session-derivation.ts";
import { detachDerivedSession } from "../../sessions/derivation/detach.ts";

export async function unarchive(ctx: HostContext, group: Parameters<GatewaySessionHost["unarchive"]>[0]): ReturnType<GatewaySessionHost["unarchive"]> {
      if (ctx.lifecycle.closing) throw new WireError("BUSY", "Gateway is shutting down.");
      const members = ctx.host.history.listArchived().filter((entry) => entry.archived?.group === group);
      const issue = ctx.host.history.readIssues().find((entry) => entry.archived?.group === group);
      if (issue) throw new WireError("HOST_ERROR", `Session ${issue.sessionId} (${issue.sessionFile}) is unreadable: ${issue.reason}`);
      if (!members.length) throw new WireError("NOT_FOUND", "Archive group is not managed by this Gateway.");
      // Validate all members before appending any unarchive record.
      for (const entry of members) readSessionDerivation(ctx, entry);
      await ctx.methods.runtimeChange(async () => {
        for (const entry of members) ctx.host.history.unarchive(entry.sessionId);
        // Best effort: keep each owner that is listed again (including owners in this group); otherwise the session
        // comes back independent. Missing owners are not recreated.
        for (const entry of members) {
          const owner = readSessionDerivation(ctx, entry)?.owner;
          const parent = owner ? ctx.host.history.get(owner) : undefined;
          if (owner && (!parent || parent.archived)) detachDerivedSession(entry.manager, ctx.derivation.derivationSchemas);
        }
      });
      console.error(`[${new Date().toISOString()}] Archive group ${group} unarchived: ${members.length} session(s).`);
      for (const entry of members) ctx.methods.publish("session_unarchived", ctx.methods.storedSession(entry.sessionId), { group });
      return { ok: true };
    }

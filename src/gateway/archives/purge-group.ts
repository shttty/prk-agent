import type { HostContext } from "../host/host-state.ts";
import type { GatewaySessionHost } from "../host/host-types.ts";
import { WireError } from "../wire/create-error.ts";

export async function purgeArchive(ctx: HostContext, group: Parameters<GatewaySessionHost["purgeArchive"]>[0], request: Parameters<GatewaySessionHost["purgeArchive"]>[1]): ReturnType<GatewaySessionHost["purgeArchive"]> {
      if (ctx.lifecycle.closing) throw new WireError("BUSY", "Gateway is shutting down.");
      if (request?.confirm !== true) throw new WireError("INVALID_REQUEST", "Permanent deletion requires explicit confirmation.");
      const members = ctx.host.history.listArchived().filter((entry) => entry.archived?.group === group);
      if (!members.length) throw new WireError("NOT_FOUND", "Archive group is not managed by this Gateway.");
      await ctx.methods.runtimeChange(async () => { for (const entry of members) ctx.host.history.delete(entry.sessionId); });
      console.error(`[${new Date().toISOString()}] Archive group ${group} purged: ${members.length} session(s), SDK files deleted.`);
      for (const entry of members) ctx.methods.publish("session_purged", entry, { group });
      return { ok: true };
    }

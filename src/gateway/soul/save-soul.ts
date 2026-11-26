import type { HostContext } from "../host/host-state.ts";
import { soulPath } from "../../config/session/soul/soul-path.ts";
import { writeSoul } from "../../config/session/soul/write-soul.ts";
import { WireError } from "../wire/create-error.ts";
import type { SoulView } from "./read-soul-settings.ts";

/** Operator edit of `session.soulFile`; sessions read it again when they are created, woken or reloaded. */
export function soulSave(ctx: HostContext, request: { content: string; revision: string }): SoulView {
  const file = ctx.host.config.session.soulFile;
  if (!file) throw new WireError("INVALID_REQUEST", "session.soulFile is not configured.");
  const path = soulPath(ctx.host.paths.home, file);
  const maxBytes = ctx.host.config.limits.contextFileBytes;
  return { configured: true, path, ...writeSoul(path, request.content, request.revision, maxBytes), maxBytes };
}

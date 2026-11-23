import type { NativeActionRequest } from "../../../gateway/wire/wire-types.ts";
import type { NativeContext, NativeTarget } from "../native-types.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";
import { requireIdle } from "../dispatch/require-idle-session.ts";

export async function reload(ctx: NativeContext, target: NativeTarget, request: NativeActionRequest) {
  requireIdle(target);
  if (!target.host) throw new WireError("READ_ONLY", "This session has no active Gateway host.");
  await target.host.reload();
  return { reloaded: true, requiresReload: target.host.getSnapshot().requiresReload ?? false };
}

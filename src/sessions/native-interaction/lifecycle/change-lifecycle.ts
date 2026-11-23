import type { NativeActionRequest } from "../../../gateway/wire/wire-types.ts";
import type { NativeContext, NativeTarget } from "../native-types.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";
import { requireIdle } from "../dispatch/require-idle-session.ts";

export async function changeLifecycle(ctx: NativeContext, target: NativeTarget, request: NativeActionRequest, action: "new" | "clone" | "fork-reply") {
  const { options } = ctx;
  if (!options.lifecycle) throw new WireError("UNAVAILABLE", "Gateway lifecycle manager is unavailable; no session identity was changed.");
  if (action === "new") {
    if (target.state === "sleeping" || (target.state === "closed" && target.readOnly)) {
      return await options.lifecycle(target, action, request.args);
    }
    const session = requireIdle(target);
    if (session.isCompacting || session.pendingMessageCount > 0 || target.host?.isIdle === false) {
      throw new WireError("BUSY", "Creating a session requires an idle source session.");
    }
  } else if (!target.readOnly && target.state !== "sleeping") requireIdle(target);
  return await options.lifecycle(target, action === "fork-reply" ? "fork" : action, request.args);
}

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { GenerationContext } from "../generation-types.ts";
import { request } from "../requests/request.ts";
import { snapshot } from "../snapshots/capture-session-snapshot.ts";
import { pushSnapshot } from "../snapshots/push-session-snapshot.ts";
import { close } from "../lifecycle/close.ts";

export function registerLifecycle(ctx: GenerationContext, pi: ExtensionAPI): void {
  const push = async (_event: unknown, sdkContext: ExtensionContext): Promise<void> => pushSnapshot(ctx, pi, sdkContext);
  pi.on("session_start", push);
  pi.on("session_info_changed", push);
  pi.on("model_select", push);
  pi.on("thinking_level_select", push);
  pi.on("agent_start", push);
  pi.on("agent_end", push);
  pi.on("session_shutdown", async (event, sdkContext) => {
    try {
      if (ctx.live && !ctx.failure) await request(ctx, "snapshot", snapshot(ctx, pi, sdkContext));
    } finally {
      await close(ctx, event.reason);
    }
  });
}

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { GenerationContext } from "../generation-types.ts";
import { request } from "../requests/request.ts";
import { snapshot } from "./capture-session-snapshot.ts";

export async function pushSnapshot(ctx: GenerationContext, pi: ExtensionAPI, sdkContext: ExtensionContext): Promise<void> {
  if (ctx.live && !ctx.closing && !ctx.failure) await request(ctx, "snapshot", snapshot(ctx, pi, sdkContext));
}

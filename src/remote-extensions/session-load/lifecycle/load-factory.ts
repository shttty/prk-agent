import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import type { LoadContext } from "../load-types.ts";
import { publish } from "../status/publish-status.ts";

export async function loadFactory(ctx: LoadContext, factory: ExtensionFactory, pi: ExtensionAPI): Promise<void> {
      try { await factory(pi); }
      catch (error) {
        for (const status of ctx.remoteStatuses.values()) status.error = error instanceof Error ? error.message : String(error);
        publish(ctx);
        throw error;
      }
}

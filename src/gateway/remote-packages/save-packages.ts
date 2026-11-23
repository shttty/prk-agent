import type { HostContext } from "../host/host-state.ts";
import type { PluginPackage } from "../../plugins/packages/package-types.ts";
import { savePluginPackages } from "../../plugins/packages/save-packages.ts";

export async function savePackages(ctx: HostContext, packages: PluginPackage[]): Promise<void> {
  await savePluginPackages(ctx.host.paths.home, ctx.host.paths.agentDir, packages);
  ctx.capabilities.instanceExtensionCatalogs.clear();
  ctx.packages.remoteCatalogStatuses.clear();
  for (const session of ctx.host.collection.snapshot()) {
    if (session.state !== "closed" && session.state !== "closing") ctx.methods.publishCapabilities(session.sessionId);
  }
}

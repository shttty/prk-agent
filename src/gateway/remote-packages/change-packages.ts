import type { HostContext } from "../host/host-state.ts";
import type { PluginChange } from "../../plugins/packages/package-types.ts";
import { readPluginPackages } from "../../plugins/packages/read-packages.ts";
import { assertPluginLocation } from "./assert-location.ts";
import { savePackages } from "./save-packages.ts";
import { pluginsList } from "./list-packages.ts";
import { WireError } from "../wire/create-error.ts";
import { preflightHostPackage } from "./preflight-host-package.ts";
import { resolvePluginPackages } from "../../plugins/packages/resolve-packages.ts";

export async function pluginsChange(ctx: HostContext, request: PluginChange) {
  await ctx.methods.exclusive(async () => {
    const packages = readPluginPackages(ctx.host.paths.home, ctx.host.paths.agentDir);
    const pkg = packages.find((entry) => entry.source === request.source);
    if (!pkg) throw new WireError("NOT_FOUND", "Plugin is not installed.");
    if (request.location !== undefined) assertPluginLocation(ctx, pkg.source, request.location);
    if ((request.location ?? pkg.location) === "host" && (request.enabled ?? pkg.enabled)) {
      const resolved = resolvePluginPackages(ctx.host.paths.home, ctx.host.paths.agentDir).find((entry) => entry.source === pkg.source)!;
      await preflightHostPackage(ctx, { ...resolved, ...request });
    }
    await savePackages(ctx, packages.map((entry) => entry === pkg ? { ...entry, ...request } : entry));
  });
  return pluginsList(ctx);
}

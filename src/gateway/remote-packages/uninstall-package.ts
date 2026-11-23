import { DefaultPackageManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import type { HostContext } from "../host/host-state.ts";
import type { PluginUninstall } from "../../plugins/packages/package-types.ts";
import { readPluginPackages } from "../../plugins/packages/read-packages.ts";
import { savePackages } from "./save-packages.ts";
import { pluginsList } from "./list-packages.ts";
import { WireError } from "../wire/create-error.ts";

export async function pluginsUninstall(ctx: HostContext, request: PluginUninstall) {
  await ctx.methods.exclusive(async () => {
    if (request.confirm !== true) throw new WireError("INVALID_REQUEST", "Plugin uninstall requires confirmation.");
    const packages = readPluginPackages(ctx.host.paths.home, ctx.host.paths.agentDir);
    if (!packages.some((pkg) => pkg.source === request.source)) throw new WireError("NOT_FOUND", "Plugin is not installed.");
    const manager = new DefaultPackageManager({ cwd: ctx.host.paths.home, agentDir: ctx.host.paths.agentDir, settingsManager: SettingsManager.inMemory() });
    await manager.remove(request.source);
    await savePackages(ctx, packages.filter((pkg) => pkg.source !== request.source));
  });
  return pluginsList(ctx);
}

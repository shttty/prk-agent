import { DefaultPackageManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { stat } from "node:fs/promises";
import { isAbsolute } from "node:path";
import type { HostContext } from "../host/host-state.ts";
import type { PluginInstall } from "../../plugins/packages/package-types.ts";
import { readPluginPackages } from "../../plugins/packages/read-packages.ts";
import { assertPluginLocation } from "./assert-location.ts";
import { savePackages } from "./save-packages.ts";
import { pluginsList } from "./list-packages.ts";
import { WireError } from "../wire/create-error.ts";
import { preflightHostPackage } from "./preflight-host-package.ts";
import { resolvePluginPackage } from "../../plugins/packages/resolve-package.ts";

export async function pluginsInstall(ctx: HostContext, request: PluginInstall) {
  await ctx.methods.exclusive(async () => {
    const source = isAbsolute(request.source) ? request.source : request.source.startsWith("npm:") ? request.source : `npm:${request.source}`;
    if (isAbsolute(source)) {
      if (!(await stat(source)).isDirectory()) throw new WireError("INVALID_REQUEST", "Local plugin source must be a directory.");
    } else if (!/^npm:(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+(?:@[^\s]+)?$/u.test(source)) throw new WireError("INVALID_REQUEST", "Install requires an npm package name or an absolute local directory.");
    const packages = readPluginPackages(ctx.host.paths.home, ctx.host.paths.agentDir);
    const identitySettings = SettingsManager.inMemory({ packages: packages.map(({ enabled: _enabled, location: _location, ...native }) => native) });
    const manager = new DefaultPackageManager({ cwd: ctx.host.paths.home, agentDir: ctx.host.paths.agentDir, settingsManager: identitySettings });
    manager.addSourceToSettings(source);
    if (identitySettings.getGlobalSettings().packages!.length === packages.length) throw new WireError("CONFLICT", "This native package identity is already installed; uninstall it before selecting another source/version.");
    const location = request.location ?? "gateway";
    assertPluginLocation(ctx, source, location);
    await manager.install(source);
    if (location === "host") await preflightHostPackage(ctx, resolvePluginPackage({ source, enabled: true, location }, ctx.host.paths.home, ctx.host.paths.agentDir));
    await savePackages(ctx, [...packages, { source, enabled: true, location }]);
  });
  return pluginsList(ctx);
}

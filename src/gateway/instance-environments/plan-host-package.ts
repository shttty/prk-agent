import type { HostContext } from "../host/host-state.ts";
import type { HostPluginPackage } from "../../plugins/packages/package-types.ts";
import type { RemoteExtensionStatus } from "../../remote-extensions/packages/package-types.ts";
import { resolvePluginExtensionPaths } from "../../plugins/packages/resolve-extension-paths.ts";
import { buildDirectoryPackage } from "../../remote-extensions/bundle/build-directory-package.ts";
import { WireError } from "../wire/create-error.ts";

export async function planHostPackage(ctx: HostContext, instance: string, pkg: HostPluginPackage, allowBuild: boolean): Promise<string | undefined> {
  let bundle: string | undefined;
  let failure: RemoteExtensionStatus | undefined;
  try {
    if ((await resolvePluginExtensionPaths(pkg)).length) {
      if (!pkg.installedPath) throw new Error(`Host plugin is not installed: ${pkg.source}`);
      bundle = (await buildDirectoryPackage(ctx.host.artifactStore, pkg.installedPath, !allowBuild)).bundle;
    }
  } catch (error) {
    if (error instanceof WireError && error.code === "ENVIRONMENT_REQUIRED") {
      failure = ctx.packages.remoteCatalogStatuses.get(instance)?.find((status) => status.name === pkg.source
        && status.errorCode === "PLUGIN_BUILD_FAILED" && typeof error.details?.packageHash === "string"
        && status.errorDetails?.packageHash === error.details.packageHash);
      if (!failure) throw error;
    } else {
      failure = { name: pkg.source, instance, location: "target", errorCode: "PLUGIN_BUILD_FAILED",
        error: error instanceof Error ? error.message : String(error),
        ...(error instanceof WireError && error.details ? { errorDetails: error.details } : {}) };
    }
  }
  const statuses = ctx.packages.remoteCatalogStatuses.get(instance) ?? [];
  if (failure) ctx.packages.remoteCatalogStatuses.set(instance, [...statuses.filter((status) => status.name !== pkg.source), failure]);
  else if (statuses.some((status) => status.name === pkg.source && status.errorCode === "PLUGIN_BUILD_FAILED")) {
    ctx.packages.remoteCatalogStatuses.set(instance, statuses.filter((status) => status.name !== pkg.source || status.errorCode !== "PLUGIN_BUILD_FAILED"));
  }
  return bundle;
}

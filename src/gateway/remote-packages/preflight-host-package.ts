import type { HostContext } from "../host/host-state.ts";
import type { HostPluginPackage } from "../../plugins/packages/package-types.ts";
import { resolvePluginExtensionPaths } from "../../plugins/packages/resolve-extension-paths.ts";
import { probeHostRegistration } from "./probe-host-registration.ts";
import { WireError } from "../wire/create-error.ts";

export async function preflightHostPackage(ctx: HostContext, pkg: HostPluginPackage): Promise<void> {
  const target = ctx.instances.targets.find((entry) => entry.local) ?? ctx.instances.targets[0];
  if (!target) return; // Ownership is still checked before saving; new registrations are checked when a host becomes available.
  const extensions = await resolvePluginExtensionPaths(pkg);
  if (!extensions.length) return;
  const registration = await probeHostRegistration(ctx.host.paths.home, pkg.name, extensions);
  const rejected = registration.packages.find((entry) => entry.error);
  if (rejected?.error) throw new WireError(rejected.errorCode ?? "INVALID_REQUEST", rejected.error, rejected.errorDetails);
  const providerErrors = registration.packages.flatMap((entry) => entry.providerErrors ?? []).filter((error) => error.operation === "register");
  if (providerErrors.length) throw new WireError("PROVIDER_POLICY", "Provider plugins require Gateway location; select Gateway explicitly.", { providerErrors });
}

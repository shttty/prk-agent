import type { HostContext } from "../../host/host-state.ts";
import type { CapabilitySettings } from "../../../config/capabilities/capability-types.ts";
import { projectCapabilities } from "../../../sessions/resource-catalog/format-capabilities.ts";
import { readProviderErrors } from "../../../sessions/model-providers/read-provider-errors.ts";
import { attachPackageLoad } from "../../../plugins/package-load/attach-package-load.ts";
import { gatewayLoadablePackages } from "../../remote-packages/list-loadable-packages.ts";

export function capabilitiesList(ctx: HostContext): CapabilitySettings {
    const entries = ctx.capabilities.globalCapabilityCatalog.entries.map(({ loaded: _loaded, ...entry }) => ({
      ...entry, locked: entry.id === "tool:kernel_code" && ctx.host.config.session.workerTools === "code",
    }));
    const layers = [ctx.capabilities.capabilityDefaults.capabilities];
    return {
      catalog: { ...attachPackageLoad(projectCapabilities(entries, ctx.capabilities.capabilityDefaults, {}, undefined, true, [], layers), gatewayLoadablePackages(ctx), layers),
        providerErrors: readProviderErrors(ctx.capabilities.globalCapabilityCatalog.providerErrors ?? [], ctx.models.modelProviders?.errors) },
      defaults: { capabilities: { ...ctx.capabilities.capabilityDefaults.capabilities }, localTools: ctx.capabilities.capabilityDefaults.localTools },
      terminal: { ...ctx.workspace.terminalOptions, quietLadderMs: [...ctx.workspace.terminalOptions.quietLadderMs] },
    };
  }

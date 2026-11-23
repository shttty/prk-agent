import type { HostContext } from "../../host/host-state.ts";
import type { CapabilitySettings } from "../../../config/capabilities/capability-types.ts";
import { projectCapabilities } from "../../../sessions/resource-catalog/format-capabilities.ts";
import { readProviderErrors } from "../../../sessions/model-providers/read-provider-errors.ts";

export function capabilitiesList(ctx: HostContext): CapabilitySettings {
    const entries = ctx.capabilities.globalCapabilityCatalog.entries.map(({ loaded: _loaded, ...entry }) => ({
      ...entry, locked: entry.id === "tool:kernel_code" && ctx.host.config.session.workerTools === "code",
    }));
    return {
      catalog: { ...projectCapabilities(entries, ctx.capabilities.capabilityDefaults, {}, undefined, true, [], [ctx.capabilities.capabilityDefaults.capabilities]),
        providerErrors: readProviderErrors(ctx.capabilities.globalCapabilityCatalog.providerErrors ?? [], ctx.models.modelProviders?.errors) },
      defaults: { capabilities: { ...ctx.capabilities.capabilityDefaults.capabilities }, localTools: ctx.capabilities.capabilityDefaults.localTools },
      terminal: { ...ctx.workspace.terminalOptions, quietLadderMs: [...ctx.workspace.terminalOptions.quietLadderMs] },
    };
  }

import { publishCapabilities } from "./publish-capabilities.ts";
import { mergeCapabilityCatalog } from "./catalog/merge-catalog.ts";
import { capabilitiesList } from "./settings/format-capability-settings.ts";
import { instanceCapabilitiesList } from "./discovery/list-capabilities.ts";
import { capabilitiesRefresh } from "./discovery/refresh-capabilities.ts";
import { capabilitiesChange } from "./settings/change-capabilities.ts";
import type { HostContext } from "../host/host-state.ts";
import type { CapabilitiesMethods } from "./capabilities-methods.ts";

export function assembleCapabilities(ctx: HostContext): CapabilitiesMethods {
  return {
    publishCapabilities: publishCapabilities.bind(undefined, ctx),
    mergeCapabilityCatalog: mergeCapabilityCatalog.bind(undefined, ctx),
    capabilitiesList: capabilitiesList.bind(undefined, ctx),
    instanceCapabilitiesList: instanceCapabilitiesList.bind(undefined, ctx),
    capabilitiesRefresh: capabilitiesRefresh.bind(undefined, ctx),
    capabilitiesChange: capabilitiesChange.bind(undefined, ctx),
  };
}

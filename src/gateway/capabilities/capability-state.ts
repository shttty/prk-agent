import type { CapabilityDefaults } from "../../config/capabilities/capability-types.ts";
import type { CapabilityCatalog } from "../../config/capabilities/capability-types.ts";

export interface CapabilityState {
  capabilityDefaults: CapabilityDefaults;
  globalCapabilityCatalog: CapabilityCatalog;
  instanceExtensionCatalogs: Map<string, CapabilityCatalog>;
  catalogLoading: Promise<void> | undefined;
}

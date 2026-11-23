import type { publishCapabilities } from "./publish-capabilities.ts";
import type { mergeCapabilityCatalog } from "./catalog/merge-catalog.ts";
import type { capabilitiesList } from "./settings/format-capability-settings.ts";
import type { instanceCapabilitiesList } from "./discovery/list-capabilities.ts";
import type { capabilitiesRefresh } from "./discovery/refresh-capabilities.ts";
import type { capabilitiesChange } from "./settings/change-capabilities.ts";

type WithoutContext<T> = T extends (ctx: never, ...args: infer A) => infer R ? (...args: A) => R : never;

export interface CapabilitiesMethods {
  publishCapabilities: WithoutContext<typeof publishCapabilities>;
  mergeCapabilityCatalog: WithoutContext<typeof mergeCapabilityCatalog>;
  capabilitiesList: WithoutContext<typeof capabilitiesList>;
  instanceCapabilitiesList: WithoutContext<typeof instanceCapabilitiesList>;
  capabilitiesRefresh: WithoutContext<typeof capabilitiesRefresh>;
  capabilitiesChange: WithoutContext<typeof capabilitiesChange>;
}

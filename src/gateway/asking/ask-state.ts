import type { HostedExtensionUI } from "../../sessions/extension-ui/ui-types.ts";

export interface AskState {
  askWatches: Map<string, { readonly ui: HostedExtensionUI; asking: boolean; unsubscribe(): void }>;
  askQueued: boolean;
}

import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";
import type { PluginConfigStore } from "../../sessions/plugin-config/config-types.ts";

export function assemblePluginConfigPlugin(store: Pick<PluginConfigStore, "createTool"> | undefined): ExtensionFactory {
  return (pi) => {
    if (store) pi.registerTool(store.createTool());
  };
}

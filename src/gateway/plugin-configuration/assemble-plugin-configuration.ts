import { pluginConfigGet } from "./get-plugin-config.ts";
import { pluginConfigSet } from "./set-plugin-config.ts";
import { pluginConfigWrite } from "./write-plugin-config.ts";
import type { HostContext } from "../host/host-state.ts";
import type { PluginConfigurationMethods } from "./plugin-configuration-methods.ts";

export function assemblePluginConfiguration(ctx: HostContext): PluginConfigurationMethods {
  return {
    pluginConfigGet: pluginConfigGet.bind(undefined, ctx),
    pluginConfigSet: pluginConfigSet.bind(undefined, ctx),
    pluginConfigWrite: pluginConfigWrite.bind(undefined, ctx),
  };
}

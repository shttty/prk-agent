import type { pluginConfigGet } from "./get-plugin-config.ts";
import type { pluginConfigSet } from "./set-plugin-config.ts";
import type { pluginConfigWrite } from "./write-plugin-config.ts";

type WithoutContext<T> = T extends (ctx: never, ...args: infer A) => infer R ? (...args: A) => R : never;

export interface PluginConfigurationMethods {
  pluginConfigGet: WithoutContext<typeof pluginConfigGet>;
  pluginConfigSet: WithoutContext<typeof pluginConfigSet>;
  pluginConfigWrite: WithoutContext<typeof pluginConfigWrite>;
}

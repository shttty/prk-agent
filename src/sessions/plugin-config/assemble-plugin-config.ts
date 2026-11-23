import { join } from "node:path";
import type { PluginConfigContext, PluginConfigSection, PluginConfigView, PluginConfigTool } from "./config-types.ts";
import { get } from "./get.ts";
import { set } from "./descriptors/register-provider-schema.ts";
import { write } from "./values/write.ts";
import { createPluginConfigTool } from "./create-tool.ts";

// Plugin "config semantics": a description of a plugin's JSON config file, written by a model after it read the plugin's
// README (tool `plugin_config`) or by the user adding only a file path. Stored per provider under
// `<PRK home>/config-schemas/<encoded provider>.json`, outside any plugin directory, so plugin updates never replace it.
// PRK checks only the format; it never guesses whether a key is used by the plugin. Values live only in the plugin's
// own file on the Gateway host; writes change exactly the edited keys and keep everything else.

export class PluginConfigStore {
  private readonly ctx: PluginConfigContext;
  constructor(home: string) { this.ctx = { directory: join(home, "config-schemas") }; }
  createTool(): PluginConfigTool { return createPluginConfigTool(this.ctx); }
  get(provider: string): PluginConfigView { return get(this.ctx, provider); }
  set(provider: string, file: string, sections: PluginConfigSection[] = []): PluginConfigView { return set(this.ctx, provider, file, sections); }
  write(provider: string, changes: readonly { key: string; value: unknown }[]): PluginConfigView { return write(this.ctx, provider, changes); }
}

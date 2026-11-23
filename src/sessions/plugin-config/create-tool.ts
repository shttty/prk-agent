import { defineTool } from "@earendil-works/pi-coding-agent";
import type { PluginConfigContext, PluginConfigTool } from "./config-types.ts";
import { PLUGIN_CONFIG_TOOL_METADATA } from "../../plugins/plugin-config/tool-metadata.ts";
import { PLUGIN_CONFIG_REQUEST_SCHEMA, PLUGIN_CONFIG_RESULT_SCHEMA } from "./descriptors/config-schema.ts";
import { execute } from "./execute.ts";

export function createPluginConfigTool(ctx: PluginConfigContext): PluginConfigTool {
  return defineTool({
    ...PLUGIN_CONFIG_TOOL_METADATA, label: "Plugin config",
    parameters: PLUGIN_CONFIG_REQUEST_SCHEMA,
    outputSchema: PLUGIN_CONFIG_RESULT_SCHEMA,
    executionMode: "sequential",
    execute: (id, request, signal) => execute(ctx, id, request, signal),
  });
}

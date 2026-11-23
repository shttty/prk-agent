import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { Static } from "typebox";
import type { sectionSchema, PLUGIN_CONFIG_REQUEST_SCHEMA } from "./descriptors/config-schema.ts";

export type PluginConfigSection = Static<typeof sectionSchema>;
export type PluginConfigArgs = Parameters<AgentTool<typeof PLUGIN_CONFIG_REQUEST_SCHEMA>["execute"]>;
export type PluginConfigTool = ToolDefinition<typeof PLUGIN_CONFIG_REQUEST_SCHEMA, PluginConfigView> & ToolDefinition<any, any, any>;

export interface PluginConfigView {
  provider: string;
  /** No stored semantics (and no file) for this provider. */
  configured: boolean;
  file?: string;
  sections: PluginConfigSection[];
  /** Current file contents with secrets replaced by MASK; `{}` when the file does not exist yet. */
  values: Record<string, unknown>;
  exists: boolean;
  /** Dot paths whose values are masked. */
  secrets: string[];
}

export interface PluginConfigContext {
  readonly directory: string;
}

export interface PluginConfigStore {
  createTool(): PluginConfigTool;
  get(provider: string): PluginConfigView;
  set(provider: string, file: string, sections?: PluginConfigSection[]): PluginConfigView;
  write(provider: string, changes: readonly { key: string; value: unknown }[]): PluginConfigView;
}

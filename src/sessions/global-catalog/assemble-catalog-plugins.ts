import type { SessionManager } from "@earendil-works/pi-coding-agent";
import { assembleSessionsPlugin } from "../../plugins/sessions/assemble-sessions-plugin.ts";
import { SESSIONS_PLUGIN_NAME } from "../../plugins/sessions/plugin-identity.ts";
import { assembleAskPlugin } from "../../plugins/ask/assemble-ask-plugin.ts";
import { ASK_PLUGIN_NAME } from "../../plugins/ask/plugin-identity.ts";
import { assembleSkillToolsPlugin } from "../../plugins/skill-tools/assemble-skill-tools-plugin.ts";
import { SKILL_TOOLS_PLUGIN_NAME } from "../../plugins/skill-tools/plugin-identity.ts";
import { assembleMemoryPlugin } from "../../plugins/memory/assemble-memory-plugin.ts";
import { MEMORY_PLUGIN_NAME } from "../../plugins/memory/plugin-identity.ts";
import { assemblePluginConfigPlugin } from "../../plugins/plugin-config/assemble-plugin-config-plugin.ts";
import { PLUGIN_CONFIG_PLUGIN_NAME } from "../../plugins/plugin-config/plugin-identity.ts";
import { assembleTerminalsPlugin } from "../../plugins/terminals/assemble-terminals-plugin.ts";
import { TERMINALS_PLUGIN_NAME } from "../../plugins/terminals/plugin-identity.ts";
import type { CatalogContext } from "./catalog-types.ts";
import { assembleKernelPlugin } from "../../plugins/kernel/assemble-kernel-plugin.ts";
import { createKernelToolDefinition } from "../../plugins/kernel/create-kernel-tool-definition.ts";
import { KERNEL_PLUGIN_NAME } from "../../plugins/kernel/plugin-identity.ts";
import { assembleToolLibraryPlugin } from "../../plugins/tool-library/assemble-tool-library-plugin.ts";
import { TOOL_LIBRARY_PLUGIN_NAME } from "../../plugins/tool-library/plugin-identity.ts";
import { assembleToolSearchPlugin } from "../../plugins/tool-search/assemble-tool-search-plugin.ts";
import { TOOL_SEARCH_PLUGIN_NAME } from "../../plugins/tool-search/plugin-identity.ts";

/** Discovery registers the real schemas without owning a session, review agent or terminal. */
export function assembleCatalogPlugins(ctx: CatalogContext, sessionManager: SessionManager) {
  const { input } = ctx;
  return [
    { name: KERNEL_PLUGIN_NAME, factory: assembleKernelPlugin(createKernelToolDefinition("target", true)) },
    { name: TOOL_LIBRARY_PLUGIN_NAME, factory: assembleToolLibraryPlugin(input.toolLibrary, {
      target: "", sessionId: () => sessionManager.getSessionId(),
      python: () => { throw new Error("Saved tool execution requires a session context."); },
    }) },
    { name: TOOL_SEARCH_PLUGIN_NAME, factory: assembleToolSearchPlugin() },
    { name: SESSIONS_PLUGIN_NAME, factory: assembleSessionsPlugin(input.sessions, {
      enabled: () => true, callableTools: () => [], delegation: () => input.config.session.delegation, flushInbox: () => undefined,
    }) },
    { name: ASK_PLUGIN_NAME, factory: assembleAskPlugin({ ui: () => undefined, timeoutMs: input.config.session.askTimeoutMs }, {
      enabled: () => true, callableTools: () => [],
    }) },
    { name: SKILL_TOOLS_PLUGIN_NAME, factory: assembleSkillToolsPlugin(input.skillLibrary, {
      enabled: () => true, callableTools: () => [], skills: () => [], sharedPaths: () => input.skillLibrary.paths(),
      noSkills: () => false, sessionId: () => sessionManager.getSessionId(), nativeToolsEnabled: () => false,
      autoSkills: () => input.config.learning.autoSkills, instance: "",
    }) },
    { name: MEMORY_PLUGIN_NAME, factory: assembleMemoryPlugin(input.config.memory.enabled ? input.memoryStore : undefined, {
      sessionId: sessionManager.getSessionId(), instance: "", source: "model",
    }, { enabled: () => true, callableTools: () => [] }) },
    { name: PLUGIN_CONFIG_PLUGIN_NAME, factory: assemblePluginConfigPlugin(input.pluginConfig) },
    { name: TERMINALS_PLUGIN_NAME, factory: assembleTerminalsPlugin(() => { throw new Error("Terminal operations require a session context."); }) },
  ];
}

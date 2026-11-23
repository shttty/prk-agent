import type { SessionManager } from "@earendil-works/pi-coding-agent";
import { assembleAskPlugin } from "../../../plugins/ask/assemble-ask-plugin.ts";
import { ASK_PLUGIN_GROUP, ASK_PLUGIN_NAME } from "../../../plugins/ask/plugin-identity.ts";
import { assembleSkillToolsPlugin } from "../../../plugins/skill-tools/assemble-skill-tools-plugin.ts";
import { SKILL_TOOLS_PLUGIN_GROUP, SKILL_TOOLS_PLUGIN_NAME } from "../../../plugins/skill-tools/plugin-identity.ts";
import { assembleMemoryPlugin } from "../../../plugins/memory/assemble-memory-plugin.ts";
import { MEMORY_PLUGIN_GROUP, MEMORY_PLUGIN_NAME } from "../../../plugins/memory/plugin-identity.ts";
import { assemblePluginConfigPlugin } from "../../../plugins/plugin-config/assemble-plugin-config-plugin.ts";
import { PLUGIN_CONFIG_PLUGIN_NAME } from "../../../plugins/plugin-config/plugin-identity.ts";
import { assembleTerminalsPlugin } from "../../../plugins/terminals/assemble-terminals-plugin.ts";
import { TERMINALS_PLUGIN_NAME } from "../../../plugins/terminals/plugin-identity.ts";
import { sendMemoryNotice } from "../../memory-review/send-memory-notice.ts";
import { explicitLayerNames } from "../../memory/layers/explicit-layer-names.ts";
import type { RuntimeContext } from "../runtime-state.ts";
import { capabilityEnabled } from "../capabilities/is-capability-enabled.ts";
import { toolEnabled } from "../capabilities/is-tool-enabled.ts";
import { localEnabled } from "../configuration/read-native-tools.ts";
import { directories } from "../tools/directories.ts";
import { allSkills } from "./skills/list-skills.ts";

export function assembleBusinessPlugins(ctx: RuntimeContext, sessionManager: SessionManager) {
  const callableTools = () => ctx.callbackSession?.getCallableToolNames().filter((name) => toolEnabled(ctx, name)) ?? [];
  return [
    { name: ASK_PLUGIN_NAME, factory: assembleAskPlugin({ ui: () => ctx.hostedUi, timeoutMs: ctx.sessionOptions.askTimeoutMs }, {
      enabled: () => capabilityEnabled(ctx, ASK_PLUGIN_GROUP), callableTools,
    }) },
    { name: SKILL_TOOLS_PLUGIN_NAME, factory: assembleSkillToolsPlugin(ctx.dependencies.skillLibrary, {
      enabled: () => capabilityEnabled(ctx, SKILL_TOOLS_PLUGIN_GROUP), callableTools,
      skills: () => ctx.callbackSession?.resourceLoader.getSkills().skills ?? [],
      target: { lease: () => ctx.skillLease, directories: directories.bind(undefined, ctx), inventory: allSkills.bind(undefined, ctx) },
      sharedPaths: () => ctx.sharedPaths, noSkills: () => ctx.sessionOptions.noSkills,
      sessionId: () => sessionManager.getSessionId(), nativeToolsEnabled: () => localEnabled(ctx),
      autoSkills: () => ctx.learningOptions.autoSkills, instance: ctx.target.id, projectId: ctx.dependencies.projectId,
    }) },
    { name: MEMORY_PLUGIN_NAME, factory: assembleMemoryPlugin(ctx.memoryStore, {
      sessionId: ctx.sessionManager.getSessionId(), instance: ctx.target.id, source: "model",
      ...(ctx.dependencies.projectId?.() === undefined ? {} : { project: ctx.dependencies.projectId()! }),
    }, {
      enabled: () => capabilityEnabled(ctx, MEMORY_PLUGIN_GROUP), callableTools,
      input: (source) => { ctx.memoryReview?.input(source); },
      saved: async (result) => {
        ctx.memoryReview?.saved();
        const explicit = ctx.memoryStore ? explicitLayerNames(ctx.memoryStore) : new Set<string>();
        const changes = result.changes.filter((change) => explicit.has(change.target));
        if (changes.length && ctx.callbackSession) await sendMemoryNotice(ctx.callbackSession, { source: "control", changes });
      },
    }) },
    { name: PLUGIN_CONFIG_PLUGIN_NAME, factory: assemblePluginConfigPlugin(ctx.dependencies.pluginConfig) },
    { name: TERMINALS_PLUGIN_NAME, factory: assembleTerminalsPlugin(ctx.modelTerminals, {
      currentBinding: () => ctx.terminalEvents, setBinding: (binding) => { ctx.terminalEvents = binding; },
    }) },
  ];
}

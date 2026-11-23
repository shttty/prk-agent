import { dirname } from "node:path";
import type { CreateAgentSessionRuntimeFactory } from "@earendil-works/pi-coding-agent";
import { createAgentSessionFromServices } from "@earendil-works/pi-coding-agent";
import { createAgentSessionServices } from "@earendil-works/pi-coding-agent";
import { createSessionSettings } from "../../session-settings/create-settings.ts";
import { selectExtensionToolNames } from "../../../config/extensions/select-extension-tool-names.ts";
import { LIBRARY_TOOL_PATTERN } from "../../../codemode/tool-library/library-tool-names.ts";
import { filteredSkillLoader } from "../../resource-catalog/assemble-skill-loader.ts";
import { targetSessionSettings } from "../../target-resources/create-settings.ts";
import { prepareRemoteExtensions } from "../../../remote-extensions/session-load/prepare.ts";
import { allSkills } from "../resources/skills/list-skills.ts";
import { skillEnabled } from "../resources/skills/is-skill-enabled.ts";
import type { RuntimeContext } from "../runtime-state.ts";
import type { ConversationContext } from "../runtime-state.ts";
import { createResourceOptions } from "../resources/create-resource-options.ts";
import { projectTrusted } from "../resources/project-trusted.ts";
import { dispatchNativeTool } from "../tools/dispatch-native-tool.ts";
import { readIsolationEnvironment } from "../../derivation/read-isolation-environment.ts";
import { ArtifactStore } from "../../../artifacts/store/assemble-store.ts";
import { KERNEL_CELL_TOOLS } from "../../../plugins/kernel/register-cell-tools.ts";

export async function createSDKSession(ctx: RuntimeContext, conversation: ConversationContext, { cwd, agentDir, sessionManager, sessionStartEvent }: Parameters<CreateAgentSessionRuntimeFactory>[0]): ReturnType<CreateAgentSessionRuntimeFactory> {
      const neutralCwd = dirname(agentDir);
      const { extensionFilter, pluginFailures } = ctx.dependencies;
      const settingsManager = createSessionSettings(cwd, agentDir, extensionFilter, ctx.targetResources ? targetSessionSettings(agentDir, ctx.targetResources.settings) : undefined, pluginFailures);
      const loaderSettings = ctx.targetResources ? createSessionSettings(neutralCwd, agentDir, extensionFilter, targetSessionSettings(agentDir, undefined, false), pluginFailures) : settingsManager;
      const remoteOptions = ctx.dependencies.remoteExtensionOptions ?? {
        channels: ctx.channels, storeDir: ctx.binDir, store: new ArtifactStore(ctx.binDir),
      };
      ctx.remoteLoad = await prepareRemoteExtensions({
        ...remoteOptions, target: ctx.target, sessionId: ctx.sessionManager.getSessionId(), ...conversation.remote,
        binChunkBytes: ctx.codemodeOptions.binChunkBytes,
        providerOwnerIds: [...(ctx.dependencies.modelProviders?.owners.keys() ?? [])],
        nativeTools: true, projectTrusted: projectTrusted.bind(undefined, settingsManager),
        mapNativeTool: (tool) => dispatchNativeTool(ctx, tool),
        projectExtensions: ctx.targetResources?.extensions,
        env: readIsolationEnvironment(ctx.sessionManager),
      });
      const services = await createAgentSessionServices({
        cwd: ctx.targetResources ? neutralCwd : cwd,
        agentDir,
        modelRuntime: ctx.dependencies.modelRuntime,
        settingsManager: loaderSettings,
        resourceLoaderOptions: createResourceOptions(ctx, conversation, cwd, agentDir, sessionManager, neutralCwd),
      });
      ctx.unfilteredLoader = services.resourceLoader;
      const extensions = services.resourceLoader.getExtensions();
      ctx.remoteLoad?.inspect(extensions.extensions, extensions.errors);
      ctx.toolInventory = [
        ...services.resourceLoader.getExtensions().extensions.flatMap((extension) => [...extension.tools.values()].map(({ definition, sourceInfo }) => ({ ...definition, exposure: definition.exposure ?? "direct", sourceInfo }))),
      ];
      const discoveredExtensions = ctx.dependencies.globalCapabilityCatalog?.().entries.filter((entry) => entry.kind === "tool"
        && (!entry.instance || (entry.instance === ctx.target.id && conversation.remote.packages.some((pkg) => pkg.name === entry.source))) && (entry.group.startsWith("group:tools:package:") || entry.group.startsWith("group:tools:mcp:") || entry.group.startsWith("group:tools:remote:"))) ?? [];
      const filteredServices = { ...services, cwd, settingsManager, resourceLoader: filteredSkillLoader(services.resourceLoader, allSkills.bind(undefined, ctx), skillEnabled.bind(undefined, ctx)) };
      const toolNames = [
        ctx.python.tool.name,
        ...Object.keys(KERNEL_CELL_TOOLS),
        ...selectExtensionToolNames(services.resourceLoader.getExtensions().extensions, ctx.dependencies.extensionFilter, true, discoveredExtensions.map((entry) => entry.name)),
      ];
      if (ctx.dependencies.toolLibrary) toolNames.push(LIBRARY_TOOL_PATTERN, "prk_library_save", "prk_library_access", "prk_library_used", "prk_library_available");
      const result = await createAgentSessionFromServices({
        services: filteredServices,
        sessionManager,
        sessionStartEvent,
        model: conversation.selectedModel,
        thinkingLevel: conversation.selectedThinkingLevel,
        tools: toolNames,
      });
      return { ...result, services: filteredServices, diagnostics: services.diagnostics };
    }

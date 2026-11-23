import type { SessionManager } from "@earendil-works/pi-coding-agent";
import { assembleKernelPlugin } from "../../../plugins/kernel/assemble-kernel-plugin.ts";
import { KERNEL_PLUGIN_GROUP, KERNEL_PLUGIN_NAME } from "../../../plugins/kernel/plugin-identity.ts";
import { assembleToolLibraryPlugin } from "../../../plugins/tool-library/assemble-tool-library-plugin.ts";
import { TOOL_LIBRARY_PLUGIN_NAME } from "../../../plugins/tool-library/plugin-identity.ts";
import { assembleToolSearchPlugin } from "../../../plugins/tool-search/assemble-tool-search-plugin.ts";
import { TOOL_SEARCH_PLUGIN_NAME } from "../../../plugins/tool-search/plugin-identity.ts";
import { isLibraryCallback } from "../../../codemode/kernel-protocol/is-library-callback.ts";
import { binPrompt } from "../../../codemode/binary-delivery/describe-binaries.ts";
import type { ConversationContext, RuntimeContext } from "../runtime-state.ts";
import { capabilityEnabled } from "../capabilities/is-capability-enabled.ts";
import { toolEnabled } from "../capabilities/is-tool-enabled.ts";
import { capabilityCatalog } from "../capabilities/get-catalog.ts";
import { fileHelper } from "../capabilities/file-helper.ts";
import { kernelCapabilities } from "../kernel/kernel-capabilities.ts";
import { localEnabled } from "../configuration/read-native-tools.ts";
import { toolDeclarations } from "../tools/project-declarations.ts";
import { prepareDeclarations } from "../tools/prepare-declarations.ts";
import { setKernelLanguage } from "../kernel/set-kernel-language.ts";
import { toolTitleEnabled } from "../configuration/read-tool-title.ts";

export function assembleClosingPlugins(ctx: RuntimeContext, conversation: ConversationContext, sessionManager: SessionManager) {
  const prepareLoadout = prepareDeclarations.bind(undefined, ctx);
  return [
    { name: KERNEL_PLUGIN_NAME, factory: assembleKernelPlugin(ctx.python.tool, {
      client: ctx.python, session: () => conversation.session, runCallback: conversation.extensionHandlers.runCell,
      enabled: () => capabilityEnabled(ctx, KERNEL_PLUGIN_GROUP), toolEnabled: () => toolEnabled(ctx, "kernel_code"),
      selectLanguage: setKernelLanguage.bind(undefined, ctx),
      prepareLoadout, afterCompaction: () => ctx.python.afterCompaction(), titleRequired: () => toolTitleEnabled(ctx),
      callableTools: () => ctx.callbackSession?.getCallableToolNames().filter((name) => !isLibraryCallback(name) && toolEnabled(ctx, name) && (!ctx.nativeNames.has(name) || localEnabled(ctx))) ?? [],
      prompt: () => {
        const snapshot = ctx.python.getSnapshot();
        return {
          helpers: ctx.helpers, toolLibrary: Boolean(ctx.dependencies.toolLibrary), autoTools: ctx.learningOptions.autoTools,
          asyncExecution: ctx.python.asyncExecution(), titleRequired: toolTitleEnabled(ctx),
          language: snapshot.language,
          ...(snapshot.state === "not_started" ? {} : { kernelScoped: Boolean(snapshot.memory) }),
          kernelCapabilities: (name) => kernelCapabilities(ctx, name), capabilityEnabled: (id) => capabilityEnabled(ctx, id, "group:tools:kernel"),
          fileHelper, binaryPrompt: () => binPrompt(ctx.binDir),
        };
      },
    }) },
    { name: TOOL_LIBRARY_PLUGIN_NAME, factory: assembleToolLibraryPlugin(ctx.dependencies.toolLibrary, {
      target: ctx.target.id, python: () => ctx.python, sessionId: () => sessionManager.getSessionId(),
      allowed: (name) => toolEnabled(ctx, name), registered: (registration) => { ctx.disposeLibrary = registration; },
    }) },
    { name: TOOL_SEARCH_PLUGIN_NAME, factory: assembleToolSearchPlugin({
      declarations: () => toolDeclarations(ctx),
      inventory: () => capabilityCatalog(ctx).entries.filter((entry) => entry.id.startsWith("tool:")).map(({ name, enabled }) => ({ name, enabled })),
      prepareLoadout,
    }) },
  ];
}

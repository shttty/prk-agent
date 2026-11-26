import { SessionManager } from "@earendil-works/pi-coding-agent";
import { HOSTED_THEME_PATHS } from "../../session-settings/theme-paths.ts";
import type { RuntimeContext } from "../runtime-state.ts";
import type { ConversationContext } from "../runtime-state.ts";
import type { RuntimeResourceOptions } from "../runtime-types.ts";
import { agentsFilesOverride } from "./agents-files-override.ts";
import { promptsOverride } from "./prompts-override.ts";
import { extensionsOverride } from "./extensions-override.ts";
import { skillsOverride } from "./skills-override.ts";
import { appendSystemPromptOverride } from "./append-system-prompt-override.ts";
import { bindSessionHooks } from "../conversation/bind-session-hooks.ts";
import { assembleSessionsPlugin } from "../../../plugins/sessions/assemble-sessions-plugin.ts";
import { SESSIONS_PLUGIN_GROUP, SESSIONS_PLUGIN_NAME } from "../../../plugins/sessions/plugin-identity.ts";
import { capabilityEnabled } from "../capabilities/is-capability-enabled.ts";
import { toolEnabled } from "../capabilities/is-tool-enabled.ts";
import { assembleBusinessPlugins } from "./assemble-business-plugins.ts";
import { assembleClosingPlugins } from "./assemble-closing-plugins.ts";
import { createSessionProviderPolicy } from "../../model-providers/create-session-provider-policy.ts";
import { disabledBuiltins } from "../../session-settings/disabled-builtins.ts";
import { assembleToolTitlePlugin } from "../../../plugins/tool-title/assemble-tool-title-plugin.ts";
import { toolTitleEnabled } from "../configuration/read-tool-title.ts";
import { bindPromptCapture } from "../../prompt-capture/bind-prompt-capture.ts";
import { bindModelRequestMetrics } from "../../model-metrics/bind-model-request-metrics.ts";

export function createResourceOptions(ctx: RuntimeContext, conversation: ConversationContext, cwd: string, agentDir: string, sessionManager: SessionManager, neutralCwd: string): RuntimeResourceOptions {
  return {
          ...ctx.resourceLoaderOptions,
          disabledBuiltinExtensions: disabledBuiltins(ctx.dependencies.pluginFailures),
          providerPolicy: createSessionProviderPolicy(ctx.dependencies.modelProviders),
          // Suppress Gateway context discovery only; the override supplies global + target context.
          ...(ctx.targetResources ? {
            noContextFiles: true,
            agentsFilesOverride: agentsFilesOverride.bind(undefined, ctx, agentDir),
            promptsOverride: promptsOverride.bind(undefined, ctx),
          } : {}),
          extensionsOverride: extensionsOverride.bind(undefined, ctx, conversation),
          additionalThemePaths: HOSTED_THEME_PATHS,
          additionalExtensionPaths: ctx.remoteLoad?.paths,
          appendSystemPrompt: [],
          skillsOverride: skillsOverride.bind(undefined, ctx, cwd, agentDir, neutralCwd),
          // Native resource reload invokes this override once; ordinary turns reuse its frozen result.
          appendSystemPromptOverride: appendSystemPromptOverride.bind(undefined, ctx, conversation, agentDir),
          extensionFactories: [{ name: "tool-title", factory: assembleToolTitlePlugin(() => toolTitleEnabled(ctx)) },
            ...(ctx.remoteLoad?.factories ?? []),
            { name: "runtime", factory: bindSessionHooks.bind(undefined, ctx, conversation) },
            ...assembleClosingPlugins(ctx, conversation, sessionManager),
            { name: SESSIONS_PLUGIN_NAME, factory: assembleSessionsPlugin(ctx.dependencies.sessions, {
              enabled: () => capabilityEnabled(ctx, SESSIONS_PLUGIN_GROUP),
              callableTools: () => ctx.callbackSession?.getCallableToolNames().filter((name) => toolEnabled(ctx, name)) ?? [],
              delegation: () => ctx.delegation,
              flushInbox: () => conversation.host?.flushPeerInbox(),
            }) },
            ...assembleBusinessPlugins(ctx, sessionManager),
            { name: "prompt-capture", factory: bindPromptCapture(ctx.promptCapture) },
            { name: "model-metrics", factory: bindModelRequestMetrics() },
          ],
        };
}

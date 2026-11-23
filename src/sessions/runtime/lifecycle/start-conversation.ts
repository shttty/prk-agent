import type { CreateAgentSessionRuntimeFactory } from "@earendil-works/pi-coding-agent";
import { createExtensionHandlerScope } from "../../extension-invocation/assemble-extension-invocation.ts";
import { readNativeSessionState } from "../../history/read-native-session-state.ts";
import type { RuntimeContext } from "../runtime-state.ts";
import type { ConversationContext } from "../runtime-state.ts";
import { discoverResources } from "../resources/discover-resources.ts";
import { selectModel } from "../conversation/select-model.ts";
import { createSDKSession } from "../conversation/create-sdk-session.ts";
import { restoreSettings } from "../conversation/restore-settings.ts";
import { attachHost } from "../conversation/attach-host.ts";
import type { RuntimeConversation } from "../runtime-types.ts";
import { startSDKRuntime } from "../conversation/start-sdk-runtime.ts";

export async function createConversation(ctx: RuntimeContext): Promise<RuntimeConversation> {
  const conversation = { extensionHandlers: createExtensionHandlerScope(), host: undefined } as ConversationContext;
  await discoverResources(ctx, conversation);
  conversation.persisted = readNativeSessionState(ctx.sessionManager, ctx.dependencies.limits);
  conversation.selectedModel = selectModel(ctx, conversation.persisted);
  conversation.selectedThinkingLevel = conversation.persisted.thinkingLevel ?? ctx.dependencies.thinkingLevel;
  const createRuntime: CreateAgentSessionRuntimeFactory = createSDKSession.bind(undefined, ctx, conversation);
  const runtimeTarget = { cwd: ctx.cwd, agentDir: ctx.dependencies.agentDir, sessionManager: ctx.sessionManager };
  await startSDKRuntime(conversation, createRuntime, runtimeTarget);
  try {
    const session = conversation.session;
    ctx.callbackSession = session;
    restoreSettings(ctx, conversation, session);
    return await attachHost(ctx, conversation, session);
  } catch (error) {
    conversation.extensionHandlers.close();
    try { if (conversation.host) await conversation.host.close(); else await conversation.dispose(); } catch (cleanup) { throw new AggregateError([error, cleanup], "Session initialization and shutdown failed."); }
    throw error;
  }
}

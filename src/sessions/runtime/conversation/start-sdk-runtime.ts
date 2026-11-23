import type { CreateAgentSessionRuntimeFactory } from "@earendil-works/pi-coding-agent";
import { AgentSessionRuntime } from "@earendil-works/pi-coding-agent";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import type { ConversationContext } from "../runtime-state.ts";

export async function startSDKRuntime(conversation: ConversationContext, createRuntime: CreateAgentSessionRuntimeFactory, runtimeTarget: { cwd: string; agentDir: string; sessionManager: SessionManager }): Promise<void> {
  // The convenience factory checks the Gateway filesystem; discovery already checked the target.
  const result = await createRuntime(runtimeTarget);
  const runtime = new AgentSessionRuntime(result.session, result.services, createRuntime, result.diagnostics, result.modelFallbackMessage);
  conversation.session = runtime.session;
  conversation.dispose = runtime.dispose.bind(runtime);
}

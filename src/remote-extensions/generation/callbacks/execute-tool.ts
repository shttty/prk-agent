import type { AgentToolResult, AgentToolUpdateCallback } from "@earendil-works/pi-agent-core";
import type { ExtensionAPI, ExtensionToolContext } from "@earendil-works/pi-coding-agent";
import type { GenerationContext } from "../generation-types.ts";
import { request } from "../requests/request.ts";
import { snapshot } from "../snapshots/capture-session-snapshot.ts";

export async function executeTool(ctx: GenerationContext, pi: ExtensionAPI, toolId: string, toolCallId: string, args: unknown, signal: AbortSignal | undefined, update: AgentToolUpdateCallback | undefined, sdkContext: ExtensionToolContext): Promise<AgentToolResult<unknown>> {
  if (ctx.closing) throw new Error("Remote extension generation is closing.");
  return await request(ctx, "execute", { toolId, toolCallId, args, snapshot: snapshot(ctx, pi, sdkContext), aborted: signal?.aborted }, { ctx: sdkContext, signal, update }) as AgentToolResult<unknown>;
}

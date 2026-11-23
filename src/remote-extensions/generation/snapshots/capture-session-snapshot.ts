import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { GenerationContext } from "../generation-types.ts";

export function snapshot(ctx: GenerationContext, pi: ExtensionAPI, sdkContext: ExtensionContext): Record<string, unknown> {
    ctx.context = sdkContext;
    return {
      revision: ++ctx.revision, cwd: ctx.options.cwd, projectTrusted: ctx.options.projectTrusted,
      sessionId: sdkContext.sessionManager.getSessionId(), sessionName: sdkContext.sessionManager.getSessionName(), sessionFile: sdkContext.sessionManager.getSessionFile(),
      branch: sdkContext.sessionManager.getBranch(),
      activeTools: pi.getActiveTools(), thinkingLevel: pi.getThinkingLevel(), model: sdkContext.model,
      isIdle: sdkContext.isIdle(), hasPendingMessages: sdkContext.hasPendingMessages(), systemPrompt: sdkContext.getSystemPrompt(),
    };
}

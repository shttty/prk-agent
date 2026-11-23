import type { HostContext } from "../../host/host-state.ts";
import { toolInputPreview } from "../../tool-content/preview-input.ts";
import { toolOutputPreview } from "../../tool-content/tool-output-preview.ts";

export function projectExtensionRender(ctx: HostContext, sessionId: string, args: Record<string, unknown>, rendered: unknown): unknown {
    if (!rendered || typeof rendered !== "object" || !("tools" in rendered) || !rendered.tools || typeof rendered.tools !== "object") return rendered;
    const runtime = ctx.host.collection.get(sessionId);
    if (!runtime) return rendered;
    const expanded = new Set(Array.isArray(args.toolContentExpandedIds) ? args.toolContentExpandedIds : []);
    const deferred = new Set<string>();
    const streaming = runtime.session.state.streamingMessage;
    const messages = runtime.session.sessionManager.getBranch().flatMap((entry) => entry.type === "message" ? [entry.message] : []);
    if (streaming) messages.push(streaming);
    const renderedIds = Object.keys(rendered.tools);
    const renderedCalls = new Set(renderedIds);
    for (const message of messages) {
      if (message.role === "assistant") {
        for (const part of message.content ?? []) if (part.type === "toolCall" && renderedCalls.has(part.id) && toolInputPreview(part.arguments, ctx.host.config.toolContent,
          part.argumentsError)) deferred.add(part.id);
      } else if (message.role === "toolResult" && renderedCalls.has(message.toolCallId) && toolOutputPreview(message, ctx.host.config.toolContent)) deferred.add(message.toolCallId);
    }
    for (const id of renderedIds) {
      const execution = runtime.extensionUi.toolExecution(id);
      if (execution && (toolInputPreview(execution.args, ctx.host.config.toolContent)
        || (execution.result !== undefined && toolOutputPreview(execution.result, ctx.host.config.toolContent)))) deferred.add(id);
    }
    const allowed = (id: string) => !deferred.has(id) || expanded.has(id);
    return {
      ...rendered,
      tools: Object.fromEntries(Object.entries(rendered.tools).filter(([id]) => allowed(id))),
      ...("toolErrors" in rendered && rendered.toolErrors && typeof rendered.toolErrors === "object"
        ? { toolErrors: Object.fromEntries(Object.entries(rendered.toolErrors).filter(([id]) => allowed(id))) } : {}),
    };
  }

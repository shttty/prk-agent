import type { HostContext } from "../../host/host-state.ts";
import type { GatewaySessionHost } from "../../host/host-types.ts";
import { WireError } from "../../wire/create-error.ts";
import type { ToolContent } from "../../tool-content/content-types.ts";
import { toolContentVersion } from "../../tool-content/hash-content.ts";

export function toolContent(ctx: HostContext, sessionId: Parameters<GatewaySessionHost["toolContent"]>[0], toolCallId: Parameters<GatewaySessionHost["toolContent"]>[1]): ReturnType<GatewaySessionHost["toolContent"]> {
      const entry = ctx.methods.stored(sessionId);
      const runtime = !entry.archived && !entry.sleeping ? ctx.host.collection.get(sessionId) : undefined;
      let args: unknown;
      let argumentsError: string | undefined;
      let result: unknown;
      let found = false;
      const messages = entry.manager.getBranch().flatMap((item) => item.type === "message" ? [item.message] : []);
      const streaming = runtime?.session.state.streamingMessage;
      if (streaming) messages.push(streaming);
      for (const message of messages) {
        if (message.role === "assistant") {
          for (const part of message.content) if (part.type === "toolCall" && part.id === toolCallId) { args = part.arguments; argumentsError = part.argumentsError; found = true; }
        } else if (message.role === "toolResult" && message.toolCallId === toolCallId) { result = message; found = true; }
      }
      const observed = runtime?.extensionUi.toolExecution(toolCallId);
      if (observed && result === undefined) { args ??= observed.args; result = observed.result; found = true; }
      if (!found) throw new WireError("NOT_FOUND", "Tool call content is not present in this SDK session.");
      const content = {
        sessionId: entry.sessionId, toolCallId,
        ...(args === undefined ? {} : { args }), ...(result === undefined ? {} : { result }),
        ...(argumentsError === undefined ? {} : { argumentsError }),
      } as ToolContent;
      return {
        ...content,
        ...(content.args === undefined ? {} : { inputVersion: toolContentVersion(content.argumentsError === undefined ? content.args : { args: content.args, argumentsError: content.argumentsError }) }),
        ...(content.result === undefined ? {} : { outputVersion: toolContentVersion(content.result) }),
      };
    }

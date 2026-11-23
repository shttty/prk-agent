import { projectConversation } from "../../../chat/conversation/project-conversation.js";
import { loadToolContent } from "./load-tool-content.js";
export async function loadTranscriptContent(ctx) {
    const identity = { sessionId: ctx.state.selectedSessionId };
    const clientId = ctx.state.session.extensionUiClientId;
    const entryIds = ctx.state.session.snapshot?.messageEntryIds;
    for (const message of projectConversation(ctx.state)) {
      for (const part of message.content) {
        if (part.type !== "tool-call" || (!part.metadata?.inputPreview && !part.metadata?.outputPreview)) continue;
        await loadToolContent(ctx, part.toolCallId, part.metadata, identity);
        if (ctx.state.selectedSessionId !== identity.sessionId || ctx.state.session.extensionUiClientId !== clientId || ctx.state.session.snapshot?.messageEntryIds !== entryIds) throw new Error("当前会话历史已切换。");
      }
    }
    return projectConversation(ctx.state);
  }


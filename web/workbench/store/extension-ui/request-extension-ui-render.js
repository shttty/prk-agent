import { projectConversation } from "../../../chat/conversation/project-conversation.js";
import { scheduleExtensionUiRender } from "./schedule-extension-ui-render.js";
export function requestExtensionUiRender(ctx, args) {
    if (args === null) { clearTimeout(ctx.renderTimer); ctx.renderTimer = null; ctx.renderPending = null; return; }
    if (ctx.disposed || !ctx.state.session.extensionUi || ctx.state.session.connection !== "connected") return;
    const toolContentExpandedIds = ctx.state.session.toolContents.size ? projectConversation(ctx.state).flatMap((message) => message.content.flatMap((part) => {
      const metadata = part.metadata;
      return part.type === "tool-call" && (metadata?.inputLoaded || metadata?.outputLoaded)
        && (!metadata.inputPreview || metadata.inputLoaded) && (!metadata.outputPreview || metadata.outputLoaded) ? [part.toolCallId] : [];
    })) : [];
    const historyStart = ctx.state.session.snapshot?.messageEntryIds?.[0];
    ctx.renderPending = { ...args, toolContentExpandedIds, ...(historyStart ? { historyStart } : {}) };
    scheduleExtensionUiRender(ctx);
  }


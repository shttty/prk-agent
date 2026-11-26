import type { StoreContext } from "../store-context-types.ts";
import type { ExtensionUiRenderArgs } from "../store-context-types.ts";
import { projectConversation } from "../../../chat/conversation/project-conversation.js";
import { scheduleExtensionUiRender } from "./schedule-extension-ui-render.ts";

/** Queue a render (the newest request wins); `null` drops the queued one. */
export function requestExtensionUiRender(ctx: StoreContext, args: ExtensionUiRenderArgs | null) {
  if (args === null) { clearTimeout(ctx.renderTimer); ctx.renderTimer = undefined; ctx.renderPending = null; return; }
  if (ctx.disposed || !ctx.state.session.extensionUi || ctx.state.session.connection !== "connected") return;
  // Tool calls whose full input or output was loaded.
  const toolContentExpandedIds: string[] = ctx.state.session.toolContents.size ? projectConversation(ctx.state).flatMap((message) => message.content.flatMap((part) => {
    if (part.type !== "tool-call") return [];
    const { inputLoaded, outputLoaded, inputPreview, outputPreview } = part.metadata;
    return (inputLoaded || outputLoaded) && (!inputPreview || inputLoaded) && (!outputPreview || outputLoaded) ? [part.toolCallId] : [];
  })) : [];
  const historyStart = ctx.state.session.snapshot?.messageEntryIds?.[0];
  ctx.renderPending = { ...args, toolContentExpandedIds, ...(historyStart ? { historyStart } : {}) };
  scheduleExtensionUiRender(ctx);
}

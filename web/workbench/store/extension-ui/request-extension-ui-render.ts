import type { StoreContext } from "../store-context-types.ts";
import type { ExtensionUiRenderArgs } from "../store-context-types.ts";
import { projectConversation } from "../../../chat/conversation/project-conversation.js";
import { scheduleExtensionUiRender } from "./schedule-extension-ui-render.ts";

/** The part of a projected transcript message this reads: a tool call whose full input or output was loaded. */
type TranscriptPart = { type: string; toolCallId: string; metadata?: { inputLoaded?: boolean; outputLoaded?: boolean; inputPreview?: unknown; outputPreview?: unknown } };

/** Queue a render (the newest request wins); `null` drops the queued one. */
export function requestExtensionUiRender(ctx: StoreContext, args: ExtensionUiRenderArgs | null) {
  if (args === null) { clearTimeout(ctx.renderTimer); ctx.renderTimer = undefined; ctx.renderPending = null; return; }
  if (ctx.disposed || !ctx.state.session.extensionUi || ctx.state.session.connection !== "connected") return;
  const toolContentExpandedIds: string[] = ctx.state.session.toolContents.size ? projectConversation(ctx.state).flatMap((message) => message.content.flatMap((part: TranscriptPart) => {
    const metadata = part.metadata;
    return part.type === "tool-call" && (metadata?.inputLoaded || metadata?.outputLoaded)
      && (!metadata.inputPreview || metadata.inputLoaded) && (!metadata.outputPreview || metadata.outputLoaded) ? [part.toolCallId] : [];
  })) : [];
  const historyStart = ctx.state.session.snapshot?.messageEntryIds?.[0];
  ctx.renderPending = { ...args, toolContentExpandedIds, ...(historyStart ? { historyStart } : {}) };
  scheduleExtensionUiRender(ctx);
}

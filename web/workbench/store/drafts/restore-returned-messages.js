import { patch } from "../updates/patch.js";
import { mergeEntry } from "../updates/merge-entry.js";
import { persistCurrentSession } from "./persist-current-session.js";
export function restoreReturnedMessages(ctx, operationId, returnedMessages, sessionId = ctx.state.selectedSessionId) {
    if (!Array.isArray(returnedMessages) || !returnedMessages.length || ctx.state.selectedSessionId !== sessionId) return;
    if (!operationId) {
      patch(ctx, { draft: [ctx.state.draft, ...returnedMessages].filter(Boolean).join("\n\n"), session: { ...ctx.state.session, restoredDraft: { count: returnedMessages.length } } });
      persistCurrentSession(ctx);
      return;
    }
    const restoredQueueCount = ctx.state.session.operations.get(operationId)?.restoredQueueCount || 0;
    const messages = returnedMessages.slice(restoredQueueCount);
    if (!messages.length) return;
    // Returned inputs were never read by the agent: drop their local send receipts so they don't read as "result unknown".
    const unclaimed = [...messages];
    const localMessages = new Map([...ctx.state.session.localMessages].filter(([, entry]) => {
      if (entry?.operationId !== operationId) return true;
      const index = unclaimed.indexOf(entry.text);
      if (index < 0) return true;
      unclaimed.splice(index, 1);
      return false;
    }));
    patch(ctx, { draft: [ctx.state.draft, ...messages].filter(Boolean).join("\n\n"), session: { ...ctx.state.session, localMessages, operations: mergeEntry(ctx, ctx.state.session.operations, operationId, { restoredQueueCount: returnedMessages.length }), restoredDraft: { operationId, count: messages.length + (ctx.state.session.restoredDraft?.operationId === operationId ? ctx.state.session.restoredDraft.count : 0) } } });
    persistCurrentSession(ctx);
  }

